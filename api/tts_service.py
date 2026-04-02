from __future__ import annotations

import logging
import subprocess
from pathlib import Path
from typing import Any

try:
    from elevenlabs import VoiceSettings
    from elevenlabs.client import ElevenLabs
except ImportError:  # pragma: no cover - backward compatibility
    from elevenlabs import VoiceSettings
    from elevenlabs import ElevenLabs

logger = logging.getLogger(__name__)


class ElevenLabsService:
    def __init__(self, api_key: str, voice_id: str, ffprobe_bin: str, ffmpeg_bin: str):
        self._api_key = api_key
        self._voice_id = voice_id
        self._ffprobe_bin = ffprobe_bin
        self._ffmpeg_bin = ffmpeg_bin
        self._client = ElevenLabs(api_key=self._api_key) if self._api_key else None

    def synthesize_line(
        self,
        text: str,
        output_mp3: Path,
        voice_id: str | None = None,
        model_id: str = "eleven_turbo_v2_5",
        voice_settings: dict[str, Any] | None = None,
    ) -> None:
        if not self._client:
            raise ValueError("ELEVENLABS_API_KEY is required for manuscript processing")

        output_mp3.parent.mkdir(parents=True, exist_ok=True)
        payload: dict[str, Any] = {
            "voice_id": voice_id or self._voice_id,
            "model_id": model_id,
            "output_format": "mp3_44100_128",
            "text": text,
        }
        if voice_settings:
            try:
                payload["voice_settings"] = VoiceSettings(**voice_settings)
            except Exception:
                payload["voice_settings"] = voice_settings

        logger.info(
            "Calling ElevenLabs text_to_speech.convert with voice_id=%s model_id=%s",
            payload["voice_id"],
            model_id,
        )
        audio_stream = self._client.text_to_speech.convert(**payload)

        with output_mp3.open("wb") as handle:
            if isinstance(audio_stream, (bytes, bytearray)):
                handle.write(audio_stream)
            else:
                for chunk in audio_stream:
                    if chunk:
                        handle.write(chunk)

    def get_duration_seconds(self, audio_file: Path) -> float:
        cmd = [
            self._ffprobe_bin,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(audio_file),
        ]
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        return max(0.0, float(result.stdout.strip() or 0.0))

    def concat_mp3(self, inputs: list[Path], output_file: Path) -> None:
        if not inputs:
            raise ValueError("Cannot concatenate zero audio files")

        output_file.parent.mkdir(parents=True, exist_ok=True)
        concat_file = output_file.parent / "concat.txt"
        concat_lines = [f"file '{path.resolve()}'" for path in inputs]
        concat_file.write_text("\n".join(concat_lines), encoding="utf-8")

        cmd = [
            self._ffmpeg_bin,
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_file),
            "-c:a",
            "libmp3lame",
            "-q:a",
            "2",
            str(output_file),
        ]
        subprocess.run(cmd, check=True, capture_output=True)

    def create_silence_mp3(self, duration_seconds: float, output_file: Path) -> None:
        if duration_seconds <= 0:
            raise ValueError("Silence duration must be positive")

        output_file.parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            self._ffmpeg_bin,
            "-y",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=44100:cl=mono",
            "-t",
            f"{duration_seconds:.3f}",
            "-c:a",
            "libmp3lame",
            "-q:a",
            "2",
            str(output_file),
        ]
        subprocess.run(cmd, check=True, capture_output=True)
