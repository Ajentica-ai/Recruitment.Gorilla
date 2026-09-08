import * as signalR from '@microsoft/signalr';
import { getAccessToken } from './api';
import type { CVDraft } from '../types';

export interface CVUploadProgressEvent {
  batchId: string;
  fileIndex: number;
  totalFiles: number;
  fileName: string;
  status: 'queued' | 'parsing' | 'completed' | 'error';
  percent: number;
  draft?: CVDraft | null;
  error?: string | null;
}

let connection: signalR.HubConnection | null = null;

export const getCVUploadHubConnection = (): signalR.HubConnection => {
  if (connection) return connection;

  const hubUrl = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/hubs/cv-upload`;

  connection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, {
      accessTokenFactory: () => getAccessToken() ?? '',
      withCredentials: true,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  return connection;
};

export const startCVUploadHub = async (): Promise<signalR.HubConnection | null> => {
  try {
    const conn = getCVUploadHubConnection();
    if (conn.state === signalR.HubConnectionState.Disconnected) {
      await conn.start();
    }
    return conn;
  } catch (err) {
    console.warn('Failed to start SignalR connection for CV upload progress:', err);
    return null;
  }
};
