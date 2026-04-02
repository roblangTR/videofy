"use client";

import {
  Alert,
  App,
  Button,
  Flex,
  Form,
  Input,
  Modal,
  Radio,
  Switch,
  Typography,
} from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { type FC, useMemo } from "react";
import { useReactive } from "ahooks";
import { useGlobalState } from "@/state/globalState";
import { logAIData } from "@/actions/logAIData";

const videoTypes = [
  {
    name: "Vertical",
    description: "Vertical video (1080x1920)",
  },
  {
    name: "Horizontal",
    description: "Horizontal video (1920x1080)",
  },
  {
    name: "Sound only",
    description: "Narration audio (mp3)",
  },
  {
    name: "Videofy Project",
    description: "Project file (JSON)",
  },
];

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
}

type FormType = {
  exportType: string;
  logo: boolean;
  audio: boolean;
  voice: boolean;
  music: boolean;
  title: string;
};

const DownloadModal: FC<Props> = ({ open, setOpen }) => {
  const { tabs, processedManuscripts, generationId } = useGlobalState();
  const {
    config: { config },
  } = useGlobalState();
  const { notification } = App.useApp();
  const [downloadForm] = Form.useForm<FormType>();

  const state = useReactive({
    isProcessing: false,
    downloadUrl: undefined as string | undefined,
    error: undefined as string | undefined,
  });

  const playerConfig = useMemo(
    () => ({
      ...(config.player || {}),
      assetBaseUrl:
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_CMS_BASE_URL || "http://127.0.0.1:3000",
    }),
    [config.player]
  );

  const downloadAsJsonProject = (title: string) => {
    const data = {
      config,
      manuscripts: tabs.map(({ manuscript }) => manuscript),
      articleUrls: tabs.map(({ articleUrl }) => articleUrl),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const currentTime = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `${title || "videofy-project"}-${currentTime}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const downloadAudio = (title: string) => {
    const firstAudioSrc = processedManuscripts[0]?.meta.audio?.src;
    if (!firstAudioSrc) {
      throw new Error("No narration audio found. Process manuscript first.");
    }

    const a = document.createElement("a");
    a.href = firstAudioSrc;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.download = `${title || "narration"}.mp3`;
    a.click();
  };

  const renderLocally = async (values: FormType) => {
    state.error = undefined;
    state.isProcessing = true;
    state.downloadUrl = undefined;

    const orientation =
      values.exportType === "Horizontal" ? "horizontal" : "vertical";

    try {
      const response = await fetch("/api/render/local", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: generationId,
          orientation,
          manuscripts: processedManuscripts,
          playerConfig,
          voice: values.audio ? values.voice : false,
          backgroundMusic: values.audio ? values.music : false,
          disabledLogo: !values.logo,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Render failed (${response.status}): ${body}`);
      }

      const payload = (await response.json()) as { downloadUrl?: string };
      if (!payload.downloadUrl) {
        throw new Error("Render finished but no download URL was returned.");
      }

      state.downloadUrl = payload.downloadUrl;
    } finally {
      state.isProcessing = false;
    }
  };

  const handleDownload = async (values: FormType) => {
    try {
      if (values.exportType === "Videofy Project") {
        downloadAsJsonProject(values.title);
        return;
      }

      if (values.exportType === "Sound only") {
        downloadAudio(values.title);
        return;
      }

      await renderLocally(values);

      if (tabs.length > 0 && generationId) {
        await logAIData(processedManuscripts, generationId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      state.error = message;
      notification.error({
        title: "Download failed",
        description: message,
        duration: 0,
      });
    }
  };

  if (!config) return <div>Error: No config detected.</div>;

  const defaultExportType =
    config.exportDefaults?.exportType &&
    videoTypes.some((t) => t.name === config.exportDefaults?.exportType)
      ? config.exportDefaults.exportType
      : videoTypes[0]?.name;

  return (
    <Modal open={open} onCancel={() => setOpen(false)} footer={null}>
      <Typography.Title level={2}>Download</Typography.Title>

      <Form<FormType>
        form={downloadForm}
        onFinish={handleDownload}
        layout="vertical"
        initialValues={{
          title: processedManuscripts[0]?.meta.title || "videofy",
          exportType: defaultExportType,
          logo:
            config.exportDefaults?.logo !== undefined
              ? config.exportDefaults.logo
              : true,
          audio:
            config.exportDefaults?.audio !== undefined
              ? config.exportDefaults.audio
              : true,
          voice:
            config.exportDefaults?.voice !== undefined
              ? config.exportDefaults.voice
              : true,
          music:
            config.exportDefaults?.music !== undefined
              ? config.exportDefaults.music
              : true,
        }}
      >
        <Form.Item name="exportType" label="Export type">
          <Radio.Group
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
            options={videoTypes.map((t) => ({
              value: t.name,
              label: t.description,
            }))}
            optionType="button"
            buttonStyle="solid"
          />
        </Form.Item>

        <Form.Item label="Title" name="title">
          <Input className="w-full" />
        </Form.Item>

        <Flex gap="middle">
          <Form.Item label="Logo" name="logo" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Audio" name="audio" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Voiceover" name="voice" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Music" name="music" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Flex>

        <Flex gap="middle">
          <Form.Item shouldUpdate>
            {({ getFieldValue }) => {
              const exportType = getFieldValue("exportType");
              let buttonText = "Process video";
              if (exportType === "Videofy Project") {
                buttonText = "Download";
              } else if (exportType === "Sound only") {
                buttonText = "Download audio";
              } else if (state.isProcessing) {
                buttonText = "Rendering locally...";
              } else if (state.downloadUrl) {
                buttonText = "Re-render";
              }

              return (
                <Button
                  type={state.downloadUrl ? "default" : "primary"}
                  htmlType="submit"
                  size="large"
                  disabled={state.isProcessing}
                  icon={state.isProcessing ? <LoadingOutlined spin /> : undefined}
                >
                  {buttonText}
                </Button>
              );
            }}
          </Form.Item>
          {state.downloadUrl && (
            <Form.Item>
              <Button
                href={state.downloadUrl}
                target="_blank"
                rel="noreferrer"
                type="primary"
                size="large"
              >
                Download video
              </Button>
            </Form.Item>
          )}
        </Flex>

        {state.error && <Alert type="error" message={`Error: ${state.error}`} />}
      </Form>
    </Modal>
  );
};

export default DownloadModal;
