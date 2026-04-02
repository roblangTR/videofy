"use client";

import { type FC, useEffect } from "react";
import { useReactive } from "ahooks";
import { useParams } from "next/navigation";
import { Tab, useGlobalState } from "@/state/globalState";
import { useRouter } from "next/navigation";
import { Alert, App, Button, Flex, Form, Spin, Tooltip, Typography } from "antd";
import { SettingOutlined, ShareAltOutlined } from "@ant-design/icons";
import PreviewOutput from "./Preview/PreviewOutput";
import SortableTabs from "../SortableTabs";
import SegmentList from "./SegmentList";
import EditConfig from "./EditConfig";
import AddFetchedArticle from "./AddFetchedArticle";

const EditPage: FC = () => {
  const {
    config,
    tabs,
    setConfig,
    setTabs,
    setSelectedProject,
    setGenerationId,
    generationId,
  } = useGlobalState();
  const router = useRouter();
  const params = useParams();
  const { message, notification } = App.useApp();
  const state = useReactive({
    editTheme: false,
    selectedTab: tabs[0]?.manuscript.meta.uniqueId,
    manuscript: tabs,
    loadingGeneration: true,
    loadError: null as string | null,
    openArticleModal: false,
    brandId: "default",
  });

  useEffect(() => {
    const generationParam = params.generation;
    const generationId = Array.isArray(generationParam)
      ? generationParam[0]
      : generationParam;
    if (!generationId) {
      state.loadingGeneration = false;
      router.replace("/");
      return;
    }
    const fetchGeneration = async () => {
      state.loadingGeneration = true;
      state.loadError = null;
      try {
        const response = await fetch(
          `/api/generations?id=${encodeURIComponent(String(generationId))}`
        );
        if (response.status === 404) {
          notification.warning({
            title: "Project no longer exists",
            description: "The generation was removed or the project folder was deleted.",
          });
          router.replace("/");
          return;
        }
        if (!response.ok) {
          throw new Error("Failed to fetch generation");
        }
        const generation = await response.json();
        if (!generation.config || !generation.projectId) {
          throw new Error("Generation payload is missing config or projectId");
        }
        setConfig({
          projectId: generation.projectId,
          config: generation.config,
        });
        setTabs(generation.data);
        setSelectedProject(
          generation.project || {
            id: generation.projectId,
            name: generation.projectId,
          }
        );
        setGenerationId(generation.id);
        state.brandId = generation.brandId || "default";
        state.selectedTab = generation.data?.[0]?.manuscript?.meta?.uniqueId;
      } catch (error) {
        console.error(error);
        state.loadError =
          error instanceof Error ? error.message : "Failed to load generation";
      } finally {
        state.loadingGeneration = false;
      }
    };
    void fetchGeneration();
  }, [
    params,
    router,
    setConfig,
    setTabs,
    setSelectedProject,
    setGenerationId,
    notification,
    state,
  ]);

  useEffect(() => {
    if (!state.selectedTab && tabs.length > 0) {
      state.selectedTab = tabs[0]?.manuscript.meta.uniqueId;
    }
  }, [state, tabs]);

  const [form] = Form.useForm();

  const handleAddArticle = async (tab: Tab) => {
    const currentTabs = (form.getFieldValue("tabs") || []) as Tab[];
    const nextTabs = [...currentTabs, tab];
    form.setFieldValue("tabs", nextTabs);
    setTabs(nextTabs);
    state.selectedTab = tab.manuscript.meta.uniqueId;

    const idFromParams = Array.isArray(params.generation)
      ? params.generation[0]
      : params.generation;
    const persistId = generationId || String(idFromParams || "");
    if (!persistId) {
      return;
    }
    const response = await fetch("/api/generations", {
      method: "PUT",
      body: JSON.stringify({
        id: persistId,
        data: nextTabs,
      }),
    });
    if (!response.ok) {
      throw new Error("Failed to persist generation after adding article");
    }
  };

  if (state.loadingGeneration || !config) {
    return (
      <Flex vertical align="center" justify="center" className="p-8">
        {state.loadError ? (
          <Alert
            type="error"
            message="Failed to load project"
            description={state.loadError}
            action={
              <Button type="primary" onClick={() => router.replace("/")}>
                Back to start
              </Button>
            }
          />
        ) : (
          <Flex vertical align="center" gap="small">
            <Spin />
            <Typography.Text>Loading project...</Typography.Text>
          </Flex>
        )}
      </Flex>
    );
  }

  return (
    <Form
      preserve
      initialValues={{ tabs, config }}
      layout="vertical"
      form={form}
    >
      <Flex vertical className="p-4">
        <Flex className="justify-between items-center py-2">
          <Typography.Title
            level={5}
            className="cursor-pointer"
            onClick={() => {
              router.push(`/`);
            }}
          >
            Videofy
          </Typography.Title>
          <Flex gap="small">
            <Tooltip title="Share video">
              <Button
                icon={<ShareAltOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  message.success("Video URL copied to clipboard.", 5);
                }}
              >
                Share
              </Button>
            </Tooltip>
            <Tooltip title="Edit theme">
              <Button
                type={state.editTheme ? "primary" : "default"}
                icon={<SettingOutlined />}
                onClick={() => (state.editTheme = !state.editTheme)}
              />
            </Tooltip>
          </Flex>
        </Flex>
        <Flex gap="middle">
          <div className="xl:flex-row flex-col w-full">
            <Form.Item noStyle className="xl:flex-1 w-full" shouldUpdate>
              {({ getFieldsValue }) => {
                const manuscripts = getFieldsValue(true).tabs;
                return (
                  <div className="xl:flex-1 w-full">
                    <PreviewOutput tabs={manuscripts} />
                  </div>
                );
              }}
            </Form.Item>
          </div>
          <div className="w-full xl:max-w-[800px] xl:grow">
            {!state.editTheme ? (
              <Form.List name={["tabs"]}>
                {(tabItems, { move }) => {
                  return (
                    <SortableTabs
                      allowAdd
                      onAdd={() => {
                        state.openArticleModal = true;
                      }}
                      activeKey={state.selectedTab}
                      onChange={(value) => {
                        state.selectedTab = value;
                      }}
                      onReorder={(from, to) => {
                        move(from, to);
                      }}
                      items={tabItems.map((t, index) => {
                        const tab = form.getFieldValue(["tabs", t.name]);
                        return {
                          key: tab.manuscript.meta.uniqueId!,
                          label: (
                            <Flex align="center">
                              <Typography.Paragraph
                                ellipsis={{
                                  tooltip: tab.manuscript.meta.title,
                                }}
                                style={{
                                  maxWidth: 250,
                                  marginBottom: 0,
                                  userSelect: "none",
                                }}
                              >
                                {tab.manuscript.meta.title}
                              </Typography.Paragraph>
                            </Flex>
                          ),
                          children: (
                            <SegmentList
                              index={t.name}
                              manuscript={tab.manuscript}
                            />
                          ),
                          forceRender: true,
                        };
                      })}
                    />
                  );
                }}
              </Form.List>
            ) : (
              <Form.Item name="config" noStyle>
                <EditConfig />
              </Form.Item>
            )}
          </div>
        </Flex>
      </Flex>
      <AddFetchedArticle
        open={state.openArticleModal}
        setOpen={(open) => {
          state.openArticleModal = open;
        }}
        brandId={state.brandId}
        onChange={handleAddArticle}
      />
    </Form>
  );
};

export default EditPage;
