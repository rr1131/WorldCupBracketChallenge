"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, requestApi } from "@/lib/api";
import type { AuthUser, MatchPrediction, PoolDetail, PoolRecord, StoredEntry } from "@/lib/types";

type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type CreatePoolInput = {
  name: string;
  description: string;
  joinPassword: string;
};

type ActionResult = { ok: true } | { ok: false; message: string };
type CreatePoolResult = { ok: true; pool: PoolRecord } | { ok: false; message: string };
type JoinPoolResult = { ok: true; pool: PoolRecord } | { ok: false; message: string };

type ApiAuthSession = {
  current_user: {
    id: string;
    username: string;
    email: string;
  };
  is_locked: boolean;
  lock_at: string | null;
};

type ApiPoolSummary = Omit<PoolRecord, "accent">;
type ApiPoolDetail = Omit<PoolDetail, "accent" | "entries"> & {
  entries: StoredEntry[];
};

type AppDataContextValue = {
  isHydrated: boolean;
  currentUser: AuthUser | null;
  entries: StoredEntry[];
  pools: PoolRecord[];
  registerUser: (input: RegisterInput) => Promise<ActionResult>;
  loginUser: (input: LoginInput) => Promise<ActionResult>;
  logoutUser: () => Promise<void>;
  createEntry: () => Promise<StoredEntry | null>;
  createPool: (input: CreatePoolInput) => Promise<CreatePoolResult>;
  deletePool: (poolId: string) => Promise<ActionResult>;
  joinPoolByInviteCode: (inviteCode: string, password?: string) => Promise<JoinPoolResult>;
  updateEntry: (entryId: string, updates: Partial<StoredEntry>) => Promise<StoredEntry | null>;
  deleteEntry: (entryId: string) => Promise<ActionResult>;
  addEntryToPool: (entryId: string, poolId: string) => Promise<ActionResult>;
  removeEntryFromPool: (entryId: string, poolId: string) => Promise<ActionResult>;
  loadEntryById: (entryId: string) => Promise<StoredEntry | null>;
  loadPoolDetail: (poolId: string) => Promise<PoolDetail | null>;
  loadPoolByInviteCode: (inviteCode: string) => Promise<PoolRecord | null>;
  getEntryById: (entryId: string) => StoredEntry | undefined;
  getPoolById: (poolId: string) => PoolRecord | undefined;
  getPoolDetailById: (poolId: string) => PoolDetail | undefined;
  getPoolByInviteCode: (inviteCode: string) => PoolRecord | undefined;
  isUserInPool: (poolId: string, userId?: string | null) => boolean;
  canEditEntry: (entry: StoredEntry | undefined) => boolean;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

function poolAccentSeed(value: string) {
  return value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function pickPoolAccent(value: string, index = 0) {
  const accents = [
    "from-[#f7d8db] to-[#f2b8be]",
    "from-[#f3c3c7] to-[#eaa0a8]",
    "from-[#f8e2e4] to-[#f0c3c8]",
    "from-[#efd0d4] to-[#e5a4ab]",
  ];
  return accents[(poolAccentSeed(value) + index) % accents.length];
}

function normalizeUser(session: ApiAuthSession["current_user"]): AuthUser {
  return {
    id: session.id,
    name: session.username,
    email: session.email,
  };
}

function normalizePrediction(prediction: MatchPrediction): MatchPrediction {
  return {
    ...prediction,
    home_score: prediction.home_score ?? "",
    away_score: prediction.away_score ?? "",
  };
}

function normalizeEntry(entry: StoredEntry): StoredEntry {
  return {
    ...entry,
    predictions: (entry.predictions ?? []).map((prediction) =>
      normalizePrediction(prediction as MatchPrediction)
    ),
    pool_ids: entry.pool_ids ?? [],
    advancing_third_place_groups: entry.advancing_third_place_groups ?? undefined,
    knockout_picks: entry.knockout_picks ?? undefined,
    knockout_preview: entry.knockout_preview ?? null,
    result: entry.result ?? null,
    max_possible_points: entry.max_possible_points ?? null,
  };
}

function decoratePool(pool: ApiPoolSummary, index = 0): PoolRecord {
  return {
    ...pool,
    accent: pickPoolAccent(pool.id, index),
  };
}

function decoratePoolDetail(detail: ApiPoolDetail, accent?: string): PoolDetail {
  return {
    ...detail,
    accent: accent ?? pickPoolAccent(detail.id),
    entries: detail.entries.map(normalizeEntry),
  };
}

function toApiUpdates(updates: Partial<StoredEntry>) {
  const payload: Record<string, unknown> = {};

  if ("entry_name" in updates) {
    payload.entry_name = updates.entry_name;
  }

  if ("predictions" in updates) {
    payload.predictions = updates.predictions?.map((prediction) => ({
      match_id: prediction.match_id,
      home_score: prediction.home_score === "" ? null : prediction.home_score,
      away_score: prediction.away_score === "" ? null : prediction.away_score,
    }));
  }

  if ("advancing_third_place_groups" in updates) {
    payload.advancing_third_place_groups = updates.advancing_third_place_groups ?? null;
  }

  if ("knockout_picks" in updates) {
    payload.knockout_picks = updates.knockout_picks ?? null;
  }

  return payload;
}

function toFriendlyError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message;
  }
  return fallback;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [entries, setEntries] = useState<StoredEntry[]>([]);
  const [entryCache, setEntryCache] = useState<Record<string, StoredEntry>>({});
  const [pools, setPools] = useState<PoolRecord[]>([]);
  const [poolDetails, setPoolDetails] = useState<Record<string, PoolDetail>>({});
  const [invitePools, setInvitePools] = useState<Record<string, PoolRecord>>({});

  const syncEntries = useCallback((nextEntries: StoredEntry[]) => {
    setEntries(nextEntries);
    setEntryCache((prev) => {
      const next = { ...prev };
      for (const entry of nextEntries) {
        next[entry.id] = entry;
      }
      return next;
    });
  }, []);

  const syncPools = useCallback((nextPools: PoolRecord[]) => {
    setPools(nextPools);
    setPoolDetails((prev) => {
      const next = { ...prev };
      for (const pool of nextPools) {
        if (next[pool.id]) {
          next[pool.id] = {
            ...next[pool.id],
            ...pool,
            accent: pool.accent,
          };
        }
      }
      return next;
    });
  }, []);

  const refreshEntries = useCallback(async () => {
    const response = await requestApi<StoredEntry[]>("/api/entries");
    const normalized = response.map(normalizeEntry);
    syncEntries(normalized);
    return normalized;
  }, [syncEntries]);

  const refreshPools = useCallback(async () => {
    const response = await requestApi<ApiPoolSummary[]>("/api/pools");
    const normalized = response.map((pool, index) => decoratePool(pool, index));
    syncPools(normalized);
    return normalized;
  }, [syncPools]);

  const bootstrapSession = useCallback(async () => {
    try {
      const session = await requestApi<ApiAuthSession>("/api/auth/me");
      setCurrentUser(normalizeUser(session.current_user));
      await Promise.all([refreshEntries(), refreshPools()]);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        console.error(error);
      }
      setCurrentUser(null);
      setEntries([]);
      setEntryCache({});
      setPools([]);
      setPoolDetails({});
    } finally {
      setIsHydrated(true);
    }
  }, [refreshEntries, refreshPools]);

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  const registerUser = useCallback(async (input: RegisterInput): Promise<ActionResult> => {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    const password = input.password.trim();

    if (!name || !email || !password) {
      return { ok: false, message: "Fill in name, email, and password." };
    }

    try {
      const session = await requestApi<ApiAuthSession>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: name,
          email,
          password,
        }),
      });
      setCurrentUser(normalizeUser(session.current_user));
      await Promise.all([refreshEntries(), refreshPools()]);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: toFriendlyError(error, "Could not create your account.") };
    }
  }, [refreshEntries, refreshPools]);

  const loginUser = useCallback(async (input: LoginInput): Promise<ActionResult> => {
    const email = input.email.trim().toLowerCase();
    const password = input.password.trim();

    if (!email || !password) {
      return { ok: false, message: "Enter your email and password." };
    }

    try {
      const session = await requestApi<ApiAuthSession>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setCurrentUser(normalizeUser(session.current_user));
      await Promise.all([refreshEntries(), refreshPools()]);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: toFriendlyError(error, "Could not log you in.") };
    }
  }, [refreshEntries, refreshPools]);

  const logoutUser = useCallback(async () => {
    try {
      await requestApi<{ ok: true }>("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error(error);
    } finally {
      setCurrentUser(null);
      setEntries([]);
      setEntryCache({});
      setPools([]);
      setPoolDetails({});
      setInvitePools({});
    }
  }, []);

  const createEntry = useCallback(async () => {
    try {
      const created = normalizeEntry(
        await requestApi<StoredEntry>("/api/entries", {
          method: "POST",
          body: JSON.stringify({}),
        })
      );
      setEntries((prev) => [created, ...prev]);
      setEntryCache((prev) => ({ ...prev, [created.id]: created }));
      return created;
    } catch (error) {
      console.error(error);
      return null;
    }
  }, []);

  const createPool = useCallback(async (input: CreatePoolInput): Promise<CreatePoolResult> => {
    const name = input.name.trim();
    const description = input.description.trim();

    if (!name) {
      return { ok: false, message: "Give your pool a name." };
    }

    try {
      const created = decoratePool(
        await requestApi<ApiPoolSummary>("/api/pools", {
          method: "POST",
          body: JSON.stringify({
            name,
            description,
            join_password: input.joinPassword.trim() || null,
          }),
        }),
        pools.length
      );
      setPools((prev) => [created, ...prev]);
      return { ok: true, pool: created };
    } catch (error) {
      return { ok: false, message: toFriendlyError(error, "Could not create this pool.") };
    }
  }, [pools.length]);

  const deletePool = useCallback(async (poolId: string): Promise<ActionResult> => {
    try {
      await requestApi<{ ok: true }>(`/api/pools/${poolId}`, { method: "DELETE" });
      setPools((prev) => prev.filter((pool) => pool.id !== poolId));
      setPoolDetails((prev) => {
        const next = { ...prev };
        delete next[poolId];
        return next;
      });
      syncEntries(entries.map((entry) => ({
        ...entry,
        pool_ids: entry.pool_ids.filter((currentPoolId) => currentPoolId !== poolId),
      })));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: toFriendlyError(error, "Could not delete this pool.") };
    }
  }, [entries, syncEntries]);

  const joinPoolByInviteCode = useCallback(
    async (inviteCode: string, password?: string): Promise<JoinPoolResult> => {
      try {
        const joined = decoratePool(
          await requestApi<ApiPoolSummary>(`/api/pools/join/${inviteCode}`, {
            method: "POST",
            body: JSON.stringify({ password: password?.trim() || null }),
          }),
          pools.length
        );
        await refreshPools();
        setInvitePools((prev) => ({ ...prev, [inviteCode.toUpperCase()]: joined }));
        return { ok: true, pool: joined };
      } catch (error) {
        return { ok: false, message: toFriendlyError(error, "Could not join this pool.") };
      }
    },
    [pools.length, refreshPools]
  );

  const updateEntry = useCallback(async (entryId: string, updates: Partial<StoredEntry>) => {
    try {
      const updated = normalizeEntry(
        await requestApi<StoredEntry>(`/api/entries/${entryId}`, {
          method: "PATCH",
          body: JSON.stringify(toApiUpdates(updates)),
        })
      );
      setEntries((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      setEntryCache((prev) => ({ ...prev, [updated.id]: updated }));
      setPoolDetails((prev) => {
        const next = { ...prev };
        for (const [poolId, detail] of Object.entries(next)) {
          if (detail.entries.some((entry) => entry.id === updated.id)) {
            next[poolId] = {
              ...detail,
              entries: detail.entries.map((entry) => (entry.id === updated.id ? updated : entry)),
            };
          }
        }
        return next;
      });
      return updated;
    } catch (error) {
      console.error(error);
      return null;
    }
  }, []);

  const deleteEntry = useCallback(async (entryId: string): Promise<ActionResult> => {
    try {
      await requestApi<{ ok: true }>(`/api/entries/${entryId}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
      setEntryCache((prev) => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
      setPoolDetails((prev) => {
        const next = { ...prev };
        for (const [poolId, detail] of Object.entries(next)) {
          next[poolId] = {
            ...detail,
            entries: detail.entries.filter((entry) => entry.id !== entryId),
          };
        }
        return next;
      });
      await refreshPools();
      return { ok: true };
    } catch (error) {
      return { ok: false, message: toFriendlyError(error, "Could not delete this entry.") };
    }
  }, [refreshPools]);

  const addEntryToPool = useCallback(async (entryId: string, poolId: string): Promise<ActionResult> => {
    try {
      await requestApi<{ ok: true }>(`/api/pools/${poolId}/entries/${entryId}`, { method: "POST" });
      await Promise.all([refreshEntries(), refreshPools()]);
      if (poolDetails[poolId]) {
        await requestApi<ApiPoolDetail>(`/api/pools/${poolId}`).then((detail) => {
          const summary = pools.find((pool) => pool.id === poolId);
          setPoolDetails((prev) => ({
            ...prev,
            [poolId]: decoratePoolDetail(detail, summary?.accent),
          }));
        });
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, message: toFriendlyError(error, "Could not add this entry to the pool.") };
    }
  }, [poolDetails, pools, refreshEntries, refreshPools]);

  const removeEntryFromPool = useCallback(async (entryId: string, poolId: string): Promise<ActionResult> => {
    try {
      await requestApi<{ ok: true }>(`/api/pools/${poolId}/entries/${entryId}`, { method: "DELETE" });
      await Promise.all([refreshEntries(), refreshPools()]);
      if (poolDetails[poolId]) {
        await requestApi<ApiPoolDetail>(`/api/pools/${poolId}`).then((detail) => {
          const summary = pools.find((pool) => pool.id === poolId);
          setPoolDetails((prev) => ({
            ...prev,
            [poolId]: decoratePoolDetail(detail, summary?.accent),
          }));
        });
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, message: toFriendlyError(error, "Could not remove this entry from the pool.") };
    }
  }, [poolDetails, pools, refreshEntries, refreshPools]);

  const loadEntryById = useCallback(async (entryId: string) => {
    try {
      const entry = normalizeEntry(await requestApi<StoredEntry>(`/api/entries/${entryId}`));
      setEntryCache((prev) => ({ ...prev, [entry.id]: entry }));
      setEntries((prev) =>
        prev.some((current) => current.id === entry.id)
          ? prev.map((current) => (current.id === entry.id ? entry : current))
          : prev
      );
      return entry;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      console.error(error);
      return null;
    }
  }, []);

  const loadPoolDetail = useCallback(async (poolId: string) => {
    try {
      const detail = await requestApi<ApiPoolDetail>(`/api/pools/${poolId}`);
      const summary = pools.find((pool) => pool.id === poolId);
      const normalized = decoratePoolDetail(detail, summary?.accent);
      setPoolDetails((prev) => ({ ...prev, [poolId]: normalized }));
      setEntryCache((prev) => {
        const next = { ...prev };
        for (const entry of normalized.entries) {
          next[entry.id] = entry;
        }
        return next;
      });
      setPools((prev) =>
        prev.map((pool) =>
          pool.id === poolId
            ? {
                ...pool,
                description: normalized.description,
                invite_code: normalized.invite_code,
                owner_id: normalized.owner_id,
                owner_name: normalized.owner_name,
                member_count: normalized.member_count,
                entry_count: normalized.entry_count,
                is_password_protected: normalized.is_password_protected,
                created_at: normalized.created_at,
                updated_at: normalized.updated_at,
              }
            : pool
        )
      );
      return normalized;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      console.error(error);
      return null;
    }
  }, [pools]);

  const loadPoolByInviteCode = useCallback(async (inviteCode: string) => {
    try {
      const pool = decoratePool(
        await requestApi<ApiPoolSummary>(`/api/pools/invite/${inviteCode}`),
        pools.length
      );
      setInvitePools((prev) => ({ ...prev, [inviteCode.toUpperCase()]: pool }));
      return pool;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      console.error(error);
      return null;
    }
  }, [pools.length]);

  const getEntryById = useCallback(
    (entryId: string) => entryCache[entryId] ?? entries.find((entry) => entry.id === entryId),
    [entries, entryCache]
  );

  const getPoolById = useCallback(
    (poolId: string) => poolDetails[poolId] ?? pools.find((pool) => pool.id === poolId),
    [poolDetails, pools]
  );

  const getPoolDetailById = useCallback((poolId: string) => poolDetails[poolId], [poolDetails]);

  const getPoolByInviteCode = useCallback(
    (inviteCode: string) => invitePools[inviteCode.toUpperCase()],
    [invitePools]
  );

  const isUserInPool = useCallback(
    (poolId: string, userId?: string | null) => Boolean(userId && pools.some((pool) => pool.id === poolId)),
    [pools]
  );

  const canEditEntry = useCallback((entry: StoredEntry | undefined) => Boolean(entry?.can_edit), []);

  const value = useMemo<AppDataContextValue>(
    () => ({
      isHydrated,
      currentUser,
      entries,
      pools,
      registerUser,
      loginUser,
      logoutUser,
      createEntry,
      createPool,
      deletePool,
      joinPoolByInviteCode,
      updateEntry,
      deleteEntry,
      addEntryToPool,
      removeEntryFromPool,
      loadEntryById,
      loadPoolDetail,
      loadPoolByInviteCode,
      getEntryById,
      getPoolById,
      getPoolDetailById,
      getPoolByInviteCode,
      isUserInPool,
      canEditEntry,
    }),
    [
      addEntryToPool,
      canEditEntry,
      createEntry,
      createPool,
      currentUser,
      deleteEntry,
      deletePool,
      entries,
      getEntryById,
      getPoolById,
      getPoolByInviteCode,
      getPoolDetailById,
      isHydrated,
      isUserInPool,
      joinPoolByInviteCode,
      loadEntryById,
      loadPoolByInviteCode,
      loadPoolDetail,
      loginUser,
      logoutUser,
      pools,
      registerUser,
      removeEntryFromPool,
      updateEntry,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used inside AppDataProvider");
  }
  return context;
}
