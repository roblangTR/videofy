import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { Config } from "@videofy/types";

export type ProjectOption = {
  id: string;
  name: string;
};

export type ApiConfig = {
  projectId: string;
  config: Config;
};

export const getProjects = async (): Promise<ProjectOption[]> => {
  const response = await axios.get<{ projects: string[] }>("/api/projects");
  return response.data.projects.map((projectId) => ({
    id: projectId,
    name: projectId,
  }));
};

export const getConfigs = async (): Promise<ApiConfig[]> => {
  const response = await axios.get<ApiConfig[]>("/api/configs");
  return response.data;
};

export type FetcherField = {
  name: string;
  label: string;
  required: boolean;
  placeholder?: string;
};

export type FetcherOption = {
  id: string;
  title: string;
  description: string;
  fields: FetcherField[];
};

export type RunFetcherPayload = {
  fetcherId: string;
  inputs: Record<string, string>;
};

export type RunFetcherResult = {
  projectId: string;
  stdout: string;
  stderr: string;
  command: string[];
};

export type BrandOption = {
  id: string;
  brandName: string;
  scriptPrompt: string;
};

export const getFetchers = async (): Promise<FetcherOption[]> => {
  const response = await axios.get<{ fetchers: FetcherOption[] }>("/api/fetchers");
  return response.data.fetchers;
};

export const runFetcherPlugin = async (
  payload: RunFetcherPayload
): Promise<RunFetcherResult> => {
  const response = await axios.post<RunFetcherResult>("/api/fetchers", payload);
  return response.data;
};

export const getBrands = async (): Promise<BrandOption[]> => {
  const response = await axios.get<{ brands: BrandOption[] }>("/api/brands");
  return response.data.brands;
};

export const setProjectBrand = async (
  projectId: string,
  brandId: string
): Promise<void> => {
  await axios.patch(`/api/projects/${encodeURIComponent(projectId)}/manifest`, {
    brandId,
  });
};

type FetchState<T> = {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

function useResource<T>(
  fetchFn: (() => Promise<T>) | null,
  deps: Array<unknown>
): FetchState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(fetchFn));

  const refresh = useCallback(async () => {
    if (!fetchFn) {
      setData(undefined);
      setError(undefined);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    void refresh();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, error, isLoading, refresh };
}

export const useProjects = () => useResource<ProjectOption[]>(getProjects, []);

export interface ProjectAssetList {
  files: string[];
}

const getProjectAssets = async (url: string): Promise<ProjectAssetList> => {
  const response = await axios.get<ProjectAssetList>(url);
  return response.data;
};

export const useProjectAssets = (projectId: string | null | undefined) => {
  const fetchFn = projectId
    ? () => getProjectAssets(`/api/assets/${projectId}`)
    : null;
  return useResource<ProjectAssetList>(fetchFn, [projectId]);
};

export const useConfigs = () =>
  useResource<ApiConfig[]>(getConfigs, []);

export const useFetchers = () =>
  useResource<FetcherOption[]>(getFetchers, []);

export const useBrands = () =>
  useResource<BrandOption[]>(getBrands, []);
