# CLI entrypoint for MMS_FA Forced Alignment
import sys
import json
import argparse
from align_engine import ForcedAlignerEngine

def main():
    parser = argparse.ArgumentParser(description="StepWise MMS_FA CLI")
    parser.add_argument("--tokens", type=str, required=True, help="JSON array of token strings or comma-separated tokens")
    parser.add_argument("--audio", type=str, required=True, help="Path to audio file (WAV/MP3)")
    parser.add_argument("--lang", type=str, default="en", help="Language code (e.g. en, hi)")

    args = parser.parse_args()

    # Parse tokens
    try:
        tokens = json.loads(args.tokens)
    except:
        tokens = [t.strip() for t in args.tokens.split(",") if t.strip()]

    # Read audio
    with open(args.audio, "rb") as f:
        audio_bytes = f.read()

    engine = ForcedAlignerEngine()
    result = engine.align(tokens, audio_bytes, args.lang)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
