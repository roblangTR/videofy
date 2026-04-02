from pathlib import Path

import api.tts_service as tts_module


class FakeTextToSpeechAPI:
    def __init__(self):
        self.calls: list[dict] = []

    def convert(self, **kwargs):
        self.calls.append(kwargs)
        return [b"abc"]


class FakeElevenLabsClient:
    last_instance = None

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.text_to_speech = FakeTextToSpeechAPI()
        FakeElevenLabsClient.last_instance = self


def test_tts_service_calls_elevenlabs_convert_with_voice_id(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(tts_module, "ElevenLabs", FakeElevenLabsClient)

    service = tts_module.ElevenLabsService(
        api_key="test-api-key",
        voice_id="fallback-voice",
        ffprobe_bin="ffprobe",
        ffmpeg_bin="ffmpeg",
    )

    out = tmp_path / "line.mp3"
    service.synthesize_line(
        text="Hei verden",
        output_mp3=out,
        voice_id="brand-voice-id",
        model_id="eleven_multilingual_v2",
        voice_settings={"stability": 1.0, "similarity_boost": 1.0},
    )

    client = FakeElevenLabsClient.last_instance
    assert client is not None
    assert len(client.text_to_speech.calls) == 1

    payload = client.text_to_speech.calls[0]
    assert payload["voice_id"] == "brand-voice-id"
    assert payload["model_id"] == "eleven_multilingual_v2"
    assert payload["text"] == "Hei verden"
    assert payload["output_format"] == "mp3_44100_128"
    assert "voice_settings" in payload
    assert out.read_bytes() == b"abc"
