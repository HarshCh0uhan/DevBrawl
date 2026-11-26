import { useCallback, useEffect, useRef, useState } from 'react';
import { CaptureUpdateAction, Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { socket } from '../utils/socket';
import { collectChanges, elementKey, mergeElements, toMap } from '../utils/canvasSync';

const SYNC_DEBOUNCE_MS = 120;

export default function CollaborativeCanvas({ roomId }) {
  const apiRef = useRef(null);
  const roomRef = useRef(roomId);
  const sentRef = useRef(new Map());
  const knownRef = useRef(new Map());
  const syncTimerRef = useRef(null);
  const [apiReady, setApiReady] = useState(false);

  const resetSyncState = useCallback(() => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    sentRef.current = new Map();
    knownRef.current = new Map();
  }, []);

  const emitChanges = useCallback(() => {
    syncTimerRef.current = null;

    const api = apiRef.current;
    const activeRoom = roomRef.current;
    if (!api || !activeRoom) return;

    const changes = collectChanges(
      api.getSceneElementsIncludingDeleted(),
      sentRef.current,
      knownRef.current
    );

    if (changes.length > 0) {
      socket.emit('canvas-change', { roomId: activeRoom, elements: changes });
    }
  }, []);

  const scheduleSync = useCallback(() => {
    if (syncTimerRef.current) return;
    syncTimerRef.current = setTimeout(emitChanges, SYNC_DEBOUNCE_MS);
  }, [emitChanges]);

  const applyRemoteChanges = useCallback((incomingElements) => {
    const api = apiRef.current;
    if (!api || !Array.isArray(incomingElements) || incomingElements.length === 0) return;

    const merged = mergeElements(api.getSceneElementsIncludingDeleted(), incomingElements);
    api.updateScene({ elements: merged, captureUpdate: CaptureUpdateAction.NEVER });

    for (const element of incomingElements) {
      if (!element?.id) continue;
      sentRef.current.set(element.id, elementKey(element));
      knownRef.current.set(element.id, element);
    }
  }, []);

  const applySnapshot = useCallback(
    (snapshotElements) => {
      const api = apiRef.current;
      if (!api) return;

      const incoming = Array.isArray(snapshotElements) ? snapshotElements : [];
      const merged = mergeElements(api.getSceneElementsIncludingDeleted(), incoming);

      // The server snapshot is the baseline of what the room already has.
      sentRef.current = new Map(
        incoming.filter((element) => element?.id).map((element) => [element.id, elementKey(element)])
      );
      knownRef.current = toMap(merged);

      api.updateScene({ elements: merged, captureUpdate: CaptureUpdateAction.NEVER });

      // Push anything created locally while offline back to the room.
      scheduleSync();
    },
    [scheduleSync]
  );

  const handleApi = useCallback((api) => {
    apiRef.current = api;
    setApiReady(Boolean(api));
  }, []);

  const handleChange = useCallback(() => {
    scheduleSync();
  }, [scheduleSync]);

  useEffect(() => {
    roomRef.current = roomId;
    resetSyncState();
  }, [roomId, resetSyncState]);

  useEffect(() => {
    if (!roomId) return;

    const requestSnapshot = () => {
      if (!apiRef.current) return;
      socket.emit('canvas-state-request', { roomId });
    };

    const handleRemoteChange = (data) => {
      if (!data || data.roomId !== roomId) return;
      applyRemoteChanges(data.elements);
    };

    const handleSnapshot = (data) => {
      if (!data || data.roomId !== roomId) return;
      applySnapshot(data.elements);
    };

    socket.on('receive-canvas-change', handleRemoteChange);
    socket.on('canvas-state-response', handleSnapshot);
    socket.on('connect', requestSnapshot);

    if (socket.connected) requestSnapshot();

    return () => {
      socket.off('receive-canvas-change', handleRemoteChange);
      socket.off('canvas-state-response', handleSnapshot);
      socket.off('connect', requestSnapshot);
    };
  }, [roomId, apiReady, applyRemoteChanges, applySnapshot]);

  useEffect(() => {
    return () => {
      if (!syncTimerRef.current) return;
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
      emitChanges();
    };
  }, [emitChanges]);

  return (
    <div className="w-full h-full min-h-0 relative">
      <Excalidraw
        excalidrawAPI={handleApi}
        onChange={handleChange}
        theme="dark"
      />
    </div>
  );
}
