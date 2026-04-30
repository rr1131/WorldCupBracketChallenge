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
import tournament from "@/data/tournament.json";
import type {
  AuthUser,
  MatchPrediction,
  PersistedAppState,
  PoolRecord,
  RegisteredUser,
  StoredEntry,
  TournamentConfig,
} from "@/lib/types";

const typedTournament = tournament as TournamentConfig;
const STORAGE_KEY = "world-cup-bracket-challenge-app-state-v1";

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
};

type AppDataContextValue = {
  isHydrated: boolean;
  currentUser: AuthUser | null;
  entries: StoredEntry[];
  pools: PoolRecord[];
  registerUser: (input: RegisterInput) => { ok: true } | { ok: false; message: string };
  loginUser: (input: LoginInput) => { ok: true } | { ok: false; message: string };
  logoutUser: () => void;
  createEntry: () => StoredEntry | null;
  createPool: (input: CreatePoolInput) => { ok: true; pool: PoolRecord } | { ok: false; message: string };
  joinPoolByInviteCode: (
    inviteCode: string
  ) => { ok: true; pool: PoolRecord } | { ok: false; message: string };
  updateEntry: (entryId: string, updates: Partial<StoredEntry>) => void;
  addEntryToPool: (entryId: string, poolId: string) => void;
  getEntryById: (entryId: string) => StoredEntry | undefined;
  getPoolById: (poolId: string) => PoolRecord | undefined;
  getPoolByInviteCode: (inviteCode: string) => PoolRecord | undefined;
  isUserInPool: (poolId: string, userId?: string | null) => boolean;
  canEditEntry: (entry: StoredEntry | undefined) => boolean;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

function createBlankPredictions(): MatchPrediction[] {
  return typedTournament.matches.map((match) => ({
    match_id: match.id,
    home_score: "",
    away_score: "",
  }));
}

function createSampleEntries(): StoredEntry[] {
  const now = new Date().toISOString();

  return [
    {
      id: "entry-maya-aurora",
      owner_id: "user-maya",
      owner_name: "Maya Chen",
      entry_name: "Aurora Press",
      created_at: now,
      updated_at: now,
      status: "scored",
      predictions: [],
      pool_ids: ["pool-atlantic", "pool-studio"],
      score_total: 418,
      result: null,
    },
    {
      id: "entry-luca-sunset",
      owner_id: "user-luca",
      owner_name: "Luca Gomez",
      entry_name: "Sunset Counter",
      created_at: now,
      updated_at: now,
      status: "scored",
      predictions: [],
      pool_ids: ["pool-atlantic"],
      score_total: 402,
      result: null,
    },
    {
      id: "entry-priya-studio",
      owner_id: "user-priya",
      owner_name: "Priya Nair",
      entry_name: "Studio Eleven",
      created_at: now,
      updated_at: now,
      status: "knockout",
      predictions: [],
      pool_ids: ["pool-studio"],
      score_total: 287,
      result: null,
    },
  ];
}

function createInviteCode(name: string) {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 6);

  return `${slug || "POOL"}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function pickPoolAccent(existingCount: number) {
  const accents = [
    "from-cyan-400/25 to-sky-500/10",
    "from-amber-300/25 to-orange-500/10",
    "from-emerald-300/25 to-teal-500/10",
    "from-rose-300/25 to-fuchsia-500/10",
  ];

  return accents[existingCount % accents.length];
}

function createDefaultState(): PersistedAppState {
  const now = new Date().toISOString();
  return {
    current_user_id: null,
    users: [
      {
        id: "user-maya",
        name: "Maya Chen",
        email: "maya@example.com",
        password: "demo1234",
      },
      {
        id: "user-luca",
        name: "Luca Gomez",
        email: "luca@example.com",
        password: "demo1234",
      },
      {
        id: "user-priya",
        name: "Priya Nair",
        email: "priya@example.com",
        password: "demo1234",
      },
    ],
    entries: createSampleEntries(),
    pools: [
      {
        id: "pool-atlantic",
        name: "Atlantic Table",
        description: "A sharper, higher-scoring pool with a few aggressive bracket styles.",
        accent: "from-cyan-400/25 to-sky-500/10",
        invite_code: "ATLANTIC26",
        owner_id: "user-maya",
        owner_name: "Maya Chen",
        member_ids: ["user-maya", "user-luca"],
        created_at: now,
      },
      {
        id: "pool-studio",
        name: "Studio League",
        description: "A smaller creative league where entries tend to diverge late in the knockout stage.",
        accent: "from-amber-300/25 to-orange-500/10",
        invite_code: "STUDIO26",
        owner_id: "user-priya",
        owner_name: "Priya Nair",
        member_ids: ["user-priya", "user-maya"],
        created_at: now,
      },
    ],
  };
}

function normalizeState(rawState: PersistedAppState): PersistedAppState {
  const fallback = createDefaultState();
  const users = rawState.users?.length ? rawState.users : fallback.users;
  const entries = (rawState.entries?.length ? rawState.entries : fallback.entries).map((entry) => ({
    ...entry,
    predictions: entry.predictions ?? createBlankPredictions(),
    pool_ids: entry.pool_ids ?? [],
  }));

  const pools = (rawState.pools?.length ? rawState.pools : fallback.pools).map((pool, index) => {
    const fallbackPool = fallback.pools.find((candidate) => candidate.id === pool.id);
    const ownerId =
      pool.owner_id ?? fallbackPool?.owner_id ?? users[0]?.id ?? "unknown-user";
    const ownerName =
      pool.owner_name ??
      fallbackPool?.owner_name ??
      users.find((user) => user.id === ownerId)?.name ??
      "Pool Owner";

    return {
      ...pool,
      accent: pool.accent ?? pickPoolAccent(index),
      invite_code: pool.invite_code ?? createInviteCode(pool.name),
      owner_id: ownerId,
      owner_name: ownerName,
      member_ids:
        pool.member_ids ??
        fallbackPool?.member_ids ??
        [ownerId],
      created_at: pool.created_at ?? fallbackPool?.created_at ?? new Date().toISOString(),
    };
  });

  const currentUserId =
    rawState.current_user_id && users.some((user) => user.id === rawState.current_user_id)
      ? rawState.current_user_id
      : null;

  return {
    current_user_id: currentUserId,
    users,
    entries,
    pools,
  };
}

function generateId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedAppState>(createDefaultState);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setState(normalizeState(JSON.parse(raw) as PersistedAppState));
      }
    } catch {
      setState(createDefaultState());
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [isHydrated, state]);

  const currentUser = useMemo(() => {
    const user = state.users.find((candidate) => candidate.id === state.current_user_id);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }, [state.current_user_id, state.users]);

  const registerUser = useCallback((input: RegisterInput) => {
    const email = input.email.trim().toLowerCase();

    if (!input.name.trim() || !email || !input.password.trim()) {
      return { ok: false as const, message: "Fill in name, email, and password." };
    }

    let outcome: { ok: true } | { ok: false; message: string } = { ok: true };

    setState((prev) => {
      const alreadyExists = prev.users.some((user) => user.email.toLowerCase() === email);
      if (alreadyExists) {
        outcome = { ok: false, message: "That email is already registered." };
        return prev;
      }

      const nextUser: RegisteredUser = {
        id: generateId("user"),
        name: input.name.trim(),
        email,
        password: input.password,
      };

      return {
        ...prev,
        current_user_id: nextUser.id,
        users: [...prev.users, nextUser],
      };
    });

    return outcome;
  }, []);

  const loginUser = useCallback((input: LoginInput) => {
    const email = input.email.trim().toLowerCase();
    let outcome: { ok: true } | { ok: false; message: string } = { ok: true };

    setState((prev) => {
      const user = prev.users.find(
        (candidate) =>
          candidate.email.toLowerCase() === email && candidate.password === input.password
      );

      if (!user) {
        outcome = { ok: false, message: "Email or password was incorrect." };
        return prev;
      }

      return {
        ...prev,
        current_user_id: user.id,
      };
    });

    return outcome;
  }, []);

  const logoutUser = useCallback(() => {
    setState((prev) => ({
      ...prev,
      current_user_id: null,
    }));
  }, []);

  const createEntry = useCallback(() => {
    let createdEntry: StoredEntry | null = null;

    setState((prev) => {
      const owner = prev.users.find((user) => user.id === prev.current_user_id);
      if (!owner) {
        createdEntry = null;
        return prev;
      }

      const now = new Date().toISOString();
      const ownedEntriesCount = prev.entries.filter((entry) => entry.owner_id === owner.id).length;
      createdEntry = {
        id: generateId("entry"),
        owner_id: owner.id,
        owner_name: owner.name,
        entry_name: `Entry ${ownedEntriesCount + 1}`,
        created_at: now,
        updated_at: now,
        status: "draft",
        predictions: createBlankPredictions(),
        pool_ids: [],
      };

      return {
        ...prev,
        entries: [createdEntry, ...prev.entries],
      };
    });

    return createdEntry;
  }, []);

  const createPool = useCallback((input: CreatePoolInput) => {
    const name = input.name.trim();
    const description = input.description.trim();
    let outcome:
      | { ok: true; pool: PoolRecord }
      | { ok: false; message: string } = { ok: false, message: "Unable to create pool." };

    setState((prev) => {
      const owner = prev.users.find((user) => user.id === prev.current_user_id);
      if (!owner) {
        outcome = { ok: false, message: "Log in before creating a pool." };
        return prev;
      }

      if (!name) {
        outcome = { ok: false, message: "Give your pool a name." };
        return prev;
      }

      const pool: PoolRecord = {
        id: generateId("pool"),
        name,
        description:
          description || "A custom World Cup bracket pool for invited competitors.",
        accent: pickPoolAccent(prev.pools.length),
        invite_code: createInviteCode(name),
        owner_id: owner.id,
        owner_name: owner.name,
        member_ids: [owner.id],
        created_at: new Date().toISOString(),
      };

      outcome = { ok: true, pool };

      return {
        ...prev,
        pools: [pool, ...prev.pools],
      };
    });

    return outcome;
  }, []);

  const updateEntry = useCallback((entryId: string, updates: Partial<StoredEntry>) => {
    setState((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              ...updates,
              updated_at: new Date().toISOString(),
            }
          : entry
      ),
    }));
  }, []);

  const addEntryToPool = useCallback((entryId: string, poolId: string) => {
    setState((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) => {
        const pool = prev.pools.find((candidate) => candidate.id === poolId);
        if (
          entry.id !== entryId ||
          entry.pool_ids.includes(poolId) ||
          entry.owner_id !== prev.current_user_id ||
          !pool ||
          !pool.member_ids.includes(entry.owner_id)
        ) {
          return entry;
        }

        return {
          ...entry,
          pool_ids: [...entry.pool_ids, poolId],
          updated_at: new Date().toISOString(),
        };
      }),
    }));
  }, []);

  const joinPoolByInviteCode = useCallback((inviteCode: string) => {
    const normalizedCode = inviteCode.trim().toUpperCase();
    let outcome:
      | { ok: true; pool: PoolRecord }
      | { ok: false; message: string } = { ok: false, message: "Unable to join pool." };

    setState((prev) => {
      const userId = prev.current_user_id;
      if (!userId) {
        outcome = { ok: false, message: "Log in before joining a pool." };
        return prev;
      }

      const pool = prev.pools.find(
        (candidate) => candidate.invite_code.toUpperCase() === normalizedCode
      );

      if (!pool) {
        outcome = { ok: false, message: "That invite link did not match a pool." };
        return prev;
      }

      if (pool.member_ids.includes(userId)) {
        outcome = { ok: true, pool };
        return prev;
      }

      const nextPool = {
        ...pool,
        member_ids: [...pool.member_ids, userId],
      };

      outcome = { ok: true, pool: nextPool };

      return {
        ...prev,
        pools: prev.pools.map((candidate) =>
          candidate.id === pool.id ? nextPool : candidate
        ),
      };
    });

    return outcome;
  }, []);

  const getEntryById = useCallback(
    (entryId: string) => state.entries.find((entry) => entry.id === entryId),
    [state.entries]
  );

  const getPoolById = useCallback(
    (poolId: string) => state.pools.find((pool) => pool.id === poolId),
    [state.pools]
  );

  const getPoolByInviteCode = useCallback(
    (inviteCode: string) =>
      state.pools.find(
        (pool) => pool.invite_code.toUpperCase() === inviteCode.trim().toUpperCase()
      ),
    [state.pools]
  );

  const isUserInPool = useCallback(
    (poolId: string, userId?: string | null) => {
      if (!userId) {
        return false;
      }

      const pool = state.pools.find((candidate) => candidate.id === poolId);
      return Boolean(pool && pool.member_ids.includes(userId));
    },
    [state.pools]
  );

  const canEditEntry = useCallback(
    (entry: StoredEntry | undefined) => Boolean(entry && currentUser && entry.owner_id === currentUser.id),
    [currentUser]
  );

  const value = useMemo<AppDataContextValue>(
    () => ({
      isHydrated,
      currentUser,
      entries: state.entries,
      pools: state.pools,
      registerUser,
      loginUser,
      logoutUser,
      createEntry,
      createPool,
      joinPoolByInviteCode,
      updateEntry,
      addEntryToPool,
      getEntryById,
      getPoolById,
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
      getEntryById,
      getPoolById,
      getPoolByInviteCode,
      isHydrated,
      isUserInPool,
      joinPoolByInviteCode,
      loginUser,
      logoutUser,
      registerUser,
      state.entries,
      state.pools,
      updateEntry,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error("useAppData must be used inside AppDataProvider.");
  }

  return context;
}
