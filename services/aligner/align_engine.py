# Core MMS Forced Aligner Engine with uroman and hybrid confidence interpolation.
import math
import hashlib
import io
import torch
import torchaudio
import soundfile as sf
import uroman
from typing import List, Dict, Any, Tuple

class ForcedAlignerEngine:
    def __init__(self, device: str = "cpu"):
        self.device = device
        self.u = uroman.Uroman()
        self.bundle = torchaudio.pipelines.MMS_FA
        print(f"[Aligner] Loading MMS_FA model on {self.device}...")
        self.model = self.bundle.get_model().to(self.device)
        self.model.eval()
        self.tokenizer = self.bundle.get_tokenizer()
        self.aligner = self.bundle.get_aligner()
        self.sample_rate = self.bundle.sample_rate # 16000
        self.cache: Dict[str, Dict[str, Any]] = {}
        print("[Aligner] MMS_FA model loaded successfully.")

    def _hash_request(self, tokens: List[str], audio_bytes: bytes, lang: str) -> str:
        h = hashlib.sha256()
        h.update(lang.encode("utf-8"))
        h.update(" ".join(tokens).encode("utf-8"))
        h.update(audio_bytes)
        return h.hexdigest()

    def align(self, tokens: List[str], audio_bytes: bytes, lang: str = "en") -> Dict[str, Any]:
        if not tokens:
            return {"timing_source": "forced_alignment", "alignment_confidence": 1.0, "marks": []}

        cache_key = self._hash_request(tokens, audio_bytes, lang)
        if cache_key in self.cache:
            return self.cache[cache_key]

        # 1. Decode audio bytes to 16kHz mono float32 tensor
        waveform, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32")
        if waveform.ndim > 1:
            waveform = waveform.mean(axis=1) # stereo -> mono
        tensor_wave = torch.from_numpy(waveform).float().unsqueeze(0) # (1, T)

        # Resample if needed
        if sr != self.sample_rate:
            resampler = torchaudio.transforms.Resample(orig_freq=sr, new_freq=self.sample_rate)
            tensor_wave = resampler(tensor_wave)

        total_audio_ms = int((tensor_wave.shape[1] / self.sample_rate) * 1000)

        # 2. Romanize tokens using uroman
        romanized_tokens = []
        for t in tokens:
            r = self.u.romanize_string(t).lower().strip()
            # MMS dictionary only accepts characters in get_labels()
            valid_chars = set(self.bundle.get_labels())
            cleaned = "".join([c for c in r if c in valid_chars])
            romanized_tokens.append(cleaned if cleaned else "a")

        # 3. Tokenize romanized words
        token_ids = self.tokenizer(romanized_tokens)

        # 4. Model inference
        with torch.inference_mode():
            emission, _ = self.model(tensor_wave.to(self.device)) # (1, num_frames, num_classes)

        # 5. Forced alignment
        # aligner returns List[List[TokenSpan]], one list of TokenSpans per input token
        token_spans = self.aligner(emission[0], token_ids)

        # Ratio mapping frame index to seconds
        num_frames = emission.shape[1]
        sec_per_frame = tensor_wave.shape[1] / (num_frames * self.sample_rate)

        raw_marks = []
        scores = []

        for idx, (original_word, spans) in enumerate(zip(tokens, token_spans)):
            if spans:
                start_f = spans[0].start
                end_f = spans[-1].end
                avg_score = sum(math.exp(s.score) for s in spans) / len(spans)
                conf = max(0.0, min(1.0, avg_score))

                start_ms = int(start_f * sec_per_frame * 1000)
                end_ms = int(end_f * sec_per_frame * 1000)

                # Clamp to ensure min 30ms duration
                if end_ms - start_ms < 30:
                    end_ms = start_ms + 30

                raw_marks.append({
                    "word_index": idx,
                    "value": original_word,
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "confidence": round(conf, 3),
                })
                scores.append(conf)
            else:
                # Token had no spans detected
                raw_marks.append({
                    "word_index": idx,
                    "value": original_word,
                    "start_ms": -1,
                    "end_ms": -1,
                    "confidence": 0.0,
                })
                scores.append(0.0)

        # 6. Hybrid interpolation for unaligned or low-confidence words (< 0.6)
        interpolated_marks = self._interpolate_timings(raw_marks, total_audio_ms)

        # 7. Monotonicity & bounds sanity check
        sanitized_marks = self._sanitize_marks(interpolated_marks, total_audio_ms)

        overall_conf = round(sum(scores) / len(scores), 3) if scores else 0.0

        result = {
            "timing_source": "forced_alignment",
            "alignment_confidence": overall_conf,
            "marks": sanitized_marks,
        }

        self.cache[cache_key] = result
        return result

    def _interpolate_timings(self, marks: List[Dict[str, Any]], total_audio_ms: int) -> List[Dict[str, Any]]:
        n = len(marks)
        if n == 0:
            return marks

        # Identify anchors (confident words >= 0.6 with valid timestamps)
        anchors = []
        for i, m in enumerate(marks):
            if m["confidence"] >= 0.6 and m["start_ms"] >= 0:
                anchors.append(i)

        if not anchors:
            # If no anchors, linearly distribute over total audio
            ms_per_word = max(50, total_audio_ms // n)
            for i, m in enumerate(marks):
                m["start_ms"] = i * ms_per_word
                m["end_ms"] = min(total_audio_ms, (i + 1) * ms_per_word)
            return marks

        # Interpolate before first anchor
        first_a = anchors[0]
        if first_a > 0:
            start_first = marks[first_a]["start_ms"]
            step = start_first // (first_a + 1)
            for i in range(first_a):
                marks[i]["start_ms"] = i * step
                marks[i]["end_ms"] = (i + 1) * step

        # Interpolate between anchors
        for k in range(len(anchors) - 1):
            left_idx = anchors[k]
            right_idx = anchors[k + 1]
            gap = right_idx - left_idx
            if gap > 1:
                t_start = marks[left_idx]["end_ms"]
                t_end = marks[right_idx]["start_ms"]
                span = max(30 * gap, t_end - t_start)
                step = span // gap
                for j in range(1, gap):
                    idx = left_idx + j
                    marks[idx]["start_ms"] = t_start + (j - 1) * step
                    marks[idx]["end_ms"] = t_start + j * step

        # Interpolate after last anchor
        last_a = anchors[-1]
        if last_a < n - 1:
            remaining = n - 1 - last_a
            t_start = marks[last_a]["end_ms"]
            span = max(30 * remaining, total_audio_ms - t_start)
            step = span // remaining
            for j in range(1, remaining + 1):
                idx = last_a + j
                marks[idx]["start_ms"] = t_start + (j - 1) * step
                marks[idx]["end_ms"] = min(total_audio_ms, t_start + j * step)

        return marks

    def _sanitize_marks(self, marks: List[Dict[str, Any]], total_audio_ms: int) -> List[Dict[str, Any]]:
        current_time = 0
        for m in marks:
            # Enforce monotonic progression
            if m["start_ms"] < current_time:
                m["start_ms"] = current_time
            if m["end_ms"] <= m["start_ms"]:
                m["end_ms"] = m["start_ms"] + 30
            # Clamp to total audio duration
            if m["end_ms"] > total_audio_ms:
                m["end_ms"] = max(m["start_ms"] + 30, total_audio_ms)
            current_time = m["start_ms"]

        return marks
