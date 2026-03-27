"use client";

import { useState, useEffect } from "react";
import type { Prospect } from "./types";
import {
  getProspects,
  updateProspect as storageUpdate,
  addProspect as storageAdd,
  deleteProspect as storageDelete,
} from "./storage";

const PROSPECTS_KEY = "klaviopro_prospects";

/**
 * Single source of truth for prospects state.
 * Re-reads localStorage on mount and whenever another tab writes.
 */
export function useProspects() {
  const [prospects, setProspects] = useState<Prospect[]>([]);

  function reload() {
    setProspects(getProspects());
  }

  useEffect(() => {
    reload();

    function onStorage(e: StorageEvent) {
      if (e.key === PROSPECTS_KEY || e.key === null) reload();
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function updateOne(updated: Prospect): Prospect {
    const saved = storageUpdate(updated);
    setProspects((ps) => ps.map((p) => (p.id === saved.id ? saved : p)));
    return saved;
  }

  function addOne(data: Parameters<typeof storageAdd>[0]): Prospect {
    const np = storageAdd(data);
    setProspects((ps) => [np, ...ps]);
    return np;
  }

  function deleteOne(id: string) {
    storageDelete(id);
    setProspects((ps) => ps.filter((p) => p.id !== id));
  }

  return { prospects, setProspects, reload, updateOne, addOne, deleteOne };
}
