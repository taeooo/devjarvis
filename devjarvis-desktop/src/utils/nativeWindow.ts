import { invoke } from '@tauri-apps/api/core';
import type { CommandResult } from '../types/jarvisCommand';

export async function showMainWindow(): Promise<void> {
  await invoke('show_main_window');
}

export async function hideMainWindow(): Promise<void> {
  await invoke('hide_main_window');
}

export async function notifyCommandResult(result: CommandResult): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }

  const permission = await resolveNotificationPermission();
  if (permission !== 'granted') {
    return false;
  }

  const notification = new Notification(result.title, {
    body: result.summary,
    tag: result.id,
    requireInteraction: result.displayMode !== 'notify',
  });

  notification.onclick = () => {
    void showMainWindow();
    notification.close();
  };

  return true;
}

async function resolveNotificationPermission(): Promise<NotificationPermission> {
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }

  return Notification.requestPermission();
}
