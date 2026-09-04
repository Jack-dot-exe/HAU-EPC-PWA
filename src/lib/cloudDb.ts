import type {
  AircraftProfile,
  PowerCheckProfileSnapshot,
  PowerCheckRecord,
  Registration,
  User,
} from "../domain/models";
import { isSupabaseEnabled, supabase } from "./supabase";

type AppUserRow = {
  id: string;
  email: string;
  role: User["role"];
  is_active: boolean;
  password_salt: string | null;
  password_hash: string | null;
  password_iterations: number | null;
};

type ProfileRow = {
  id: string;
  model_name: string;
  engine: string;
  engine_count: number | null;
  engines: AircraftProfile["engines"] | null;
  check_types: AircraftProfile["checkTypes"];
  limits: AircraftProfile["limits"];
  input_schema: AircraftProfile["inputSchema"];
  calculation_id: AircraftProfile["calculationId"];
  execution_mode: AircraftProfile["executionMode"] | null;
  input_only_config: AircraftProfile["inputOnlyConfig"] | null;
  power_check_description: string | null;
};

type RegistrationRow = {
  id: string;
  tail_number: string;
  profile_id: string;
  engines: Registration["engines"] | null;
};

type PowerCheckRow = {
  id: string;
  created_at: string;
  check_date: string;
  registration_id: string;
  check_type: PowerCheckRecord["checkType"];
  total_time_hrs: number | null;
  calculation_version: string | null;
  profile_execution_mode: PowerCheckRecord["profileExecutionMode"] | null;
  created_by_user_id: string | null;
  created_by_user_email: string | null;
  schema_version: 1 | 2 | null;
  profile_snapshot: PowerCheckProfileSnapshot | null;
  check_values: PowerCheckRecord["values"] | null;
  check_result: PowerCheckRecord["result"] | null;
  overall_result: PowerCheckRecord["overallResult"] | null;
};

type PowerCheckEngineRow = {
  check_id: string;
  engine_id: string;
  engine_label: string;
  engine_values: NonNullable<PowerCheckRecord["engines"]>[number]["values"];
  engine_result: NonNullable<PowerCheckRecord["engines"]>[number]["result"] | null;
  position: number;
};

function assertDb() {
  if (!isSupabaseEnabled || !supabase) return null;
  return supabase;
}

function toUser(row: AppUserRow): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    passwordSalt: row.password_salt ?? undefined,
    passwordHash: row.password_hash ?? undefined,
    passwordIterations: row.password_iterations ?? undefined,
  };
}

function toUserRow(user: User): AppUserRow {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    is_active: user.isActive,
    password_salt: user.passwordSalt ?? null,
    password_hash: user.passwordHash ?? null,
    password_iterations: user.passwordIterations ?? null,
  };
}

function toProfile(row: ProfileRow): AircraftProfile {
  return {
    id: row.id,
    modelName: row.model_name,
    engine: row.engine,
    engineCount: row.engine_count ?? undefined,
    engines: row.engines ?? undefined,
    checkTypes: row.check_types,
    limits: row.limits,
    inputSchema: row.input_schema,
    calculationId: row.calculation_id,
    executionMode: row.execution_mode ?? "calculated",
    inputOnlyConfig: row.input_only_config ?? undefined,
    powerCheckDescription: row.power_check_description ?? undefined,
  };
}

function toProfileRow(profile: AircraftProfile): ProfileRow {
  return {
    id: profile.id,
    model_name: profile.modelName,
    engine: profile.engine,
    engine_count: profile.engineCount ?? null,
    engines: profile.engines ?? null,
    check_types: profile.checkTypes,
    limits: profile.limits,
    input_schema: profile.inputSchema,
    calculation_id: profile.calculationId,
    execution_mode: profile.executionMode ?? "calculated",
    input_only_config: profile.inputOnlyConfig ?? null,
    power_check_description: profile.powerCheckDescription ?? null,
  };
}

function toRegistration(row: RegistrationRow): Registration {
  return {
    id: row.id,
    tailNumber: row.tail_number,
    profileId: row.profile_id,
    engines: row.engines ?? undefined,
  };
}

function toRegistrationRow(registration: Registration): RegistrationRow {
  return {
    id: registration.id,
    tail_number: registration.tailNumber,
    profile_id: registration.profileId,
    engines: registration.engines ?? null,
  };
}

function toCheckRow(check: PowerCheckRecord): PowerCheckRow {
  return {
    id: check.id,
    created_at: check.createdAtIso,
    check_date: check.checkDate,
    registration_id: check.registrationId,
    check_type: check.checkType,
    total_time_hrs: check.totalTimeHrs ?? null,
    calculation_version: check.calculationVersion ?? null,
    profile_execution_mode: check.profileExecutionMode ?? null,
    created_by_user_id: check.createdByUserId ?? null,
    created_by_user_email: check.createdByUserEmail ?? null,
    schema_version: check.schemaVersion ?? null,
    profile_snapshot: check.profileSnapshot ?? null,
    check_values: check.values ?? null,
    check_result: check.result ?? null,
    overall_result: check.overallResult ?? null,
  };
}

function toCheck(check: PowerCheckRow, engines: PowerCheckEngineRow[]): PowerCheckRecord {
  return {
    id: check.id,
    createdAtIso: check.created_at,
    checkDate: check.check_date,
    registrationId: check.registration_id,
    checkType: check.check_type,
    totalTimeHrs: check.total_time_hrs ?? undefined,
    calculationVersion: check.calculation_version ?? undefined,
    profileExecutionMode: check.profile_execution_mode ?? undefined,
    createdByUserId: check.created_by_user_id ?? undefined,
    createdByUserEmail: check.created_by_user_email ?? undefined,
    schemaVersion: check.schema_version ?? undefined,
    profileSnapshot: check.profile_snapshot ?? undefined,
    values: check.check_values ?? undefined,
    result: check.check_result ?? undefined,
    overallResult: check.overall_result ?? undefined,
    engines: engines
      .sort((a, b) => a.position - b.position)
      .map((e) => ({
        engineId: e.engine_id,
        engineLabel: e.engine_label,
        values: e.engine_values,
        result: e.engine_result ?? undefined,
      })),
  };
}

export async function isCloudDbReachable(): Promise<boolean> {
  const db = assertDb();
  if (!db) return false;

  const { error } = await db
    .from("epc_power_checks")
    .select("id", { head: true, count: "exact" })
    .limit(1);

  return !error;
}

export async function fetchUsersCloud(): Promise<User[] | null> {
  const db = assertDb();
  if (!db) return null;

  const { data, error } = await db
    .from("epc_users")
    .select("id,email,role,is_active,password_salt,password_hash,password_iterations")
    .order("email", { ascending: true });
  if (error) throw error;
  return (data as AppUserRow[]).map(toUser);
}

export async function upsertUserCloud(user: User): Promise<void> {
  const db = assertDb();
  if (!db) return;
  const { error } = await db.from("epc_users").upsert(toUserRow(user));
  if (error) throw error;
}

export async function deleteUserCloud(id: string): Promise<void> {
  const db = assertDb();
  if (!db) return;
  const { error } = await db.from("epc_users").delete().eq("id", id);
  if (error) throw error;
}

export async function replaceUsersCloud(users: User[]): Promise<void> {
  const db = assertDb();
  if (!db) return;
  const { error: delError } = await db.from("epc_users").delete().neq("id", "");
  if (delError) throw delError;
  if (users.length === 0) return;
  const { error: insError } = await db.from("epc_users").upsert(users.map(toUserRow));
  if (insError) throw insError;
}

export async function fetchProfilesCloud(): Promise<AircraftProfile[] | null> {
  const db = assertDb();
  if (!db) return null;

  const { data, error } = await db
    .from("epc_profiles")
    .select("id,model_name,engine,power_check_description,engine_count,engines,check_types,limits,input_schema,calculation_id,execution_mode,input_only_config")
    .order("model_name", { ascending: true });
  if (error) throw error;
  return (data as ProfileRow[]).map(toProfile);
}

export async function upsertProfileCloud(profile: AircraftProfile): Promise<void> {
  const db = assertDb();
  if (!db) return;
  const { error } = await db.from("epc_profiles").upsert(toProfileRow(profile));
  if (error) throw error;
}

export async function deleteProfileCloud(id: string): Promise<void> {
  const db = assertDb();
  if (!db) return;
  const { error } = await db.from("epc_profiles").delete().eq("id", id);
  if (error) throw error;
}

export async function replaceProfilesCloud(profiles: AircraftProfile[]): Promise<void> {
  const db = assertDb();
  if (!db) return;
  const { error: delError } = await db.from("epc_profiles").delete().neq("id", "");
  if (delError) throw delError;
  if (profiles.length === 0) return;
  const { error: insError } = await db.from("epc_profiles").upsert(profiles.map(toProfileRow));
  if (insError) throw insError;
}

export async function fetchRegistrationsCloud(): Promise<Registration[] | null> {
  const db = assertDb();
  if (!db) return null;

  const { data, error } = await db
    .from("epc_registrations")
    .select("id,tail_number,profile_id,engines")
    .order("tail_number", { ascending: true });
  if (error) throw error;
  return (data as RegistrationRow[]).map(toRegistration);
}

export async function upsertRegistrationCloud(registration: Registration): Promise<void> {
  const db = assertDb();
  if (!db) return;
  const { error } = await db.from("epc_registrations").upsert(toRegistrationRow(registration));
  if (error) throw error;
}

export async function deleteRegistrationCloud(id: string): Promise<void> {
  const db = assertDb();
  if (!db) return;
  const { error } = await db.from("epc_registrations").delete().eq("id", id);
  if (error) throw error;
}

export async function replaceRegistrationsCloud(registrations: Registration[]): Promise<void> {
  const db = assertDb();
  if (!db) return;
  const { error: delError } = await db.from("epc_registrations").delete().neq("id", "");
  if (delError) throw delError;
  if (registrations.length === 0) return;
  const { error: insError } = await db
    .from("epc_registrations")
    .upsert(registrations.map(toRegistrationRow));
  if (insError) throw insError;
}

export async function fetchChecksCloud(): Promise<PowerCheckRecord[] | null> {
  const db = assertDb();
  if (!db) return null;

  const [checksRes, enginesRes] = await Promise.all([
    db
      .from("epc_power_checks")
      .select("id,created_at,check_date,registration_id,check_type,total_time_hrs,calculation_version,profile_execution_mode,created_by_user_id,created_by_user_email,schema_version,profile_snapshot,check_values,check_result,overall_result")
      .order("check_date", { ascending: false })
      .order("created_at", { ascending: false }),
    db
      .from("epc_power_check_engines")
      .select("check_id,engine_id,engine_label,engine_values,engine_result,position"),
  ]);

  if (checksRes.error) throw checksRes.error;
  if (enginesRes.error) throw enginesRes.error;

  const enginesByCheck = new Map<string, PowerCheckEngineRow[]>();
  for (const row of (enginesRes.data ?? []) as PowerCheckEngineRow[]) {
    const list = enginesByCheck.get(row.check_id) ?? [];
    list.push(row);
    enginesByCheck.set(row.check_id, list);
  }

  return ((checksRes.data ?? []) as PowerCheckRow[]).map((check) =>
    toCheck(check, enginesByCheck.get(check.id) ?? [])
  );
}

export async function checkExistsInCloud(id: string): Promise<boolean> {
  const db = assertDb();
  if (!db) return false;

  const { data, error } = await db
    .from("epc_power_checks")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function upsertCheckCloud(check: PowerCheckRecord): Promise<void> {
  const db = assertDb();
  if (!db) return;

  const { error: checkError } = await db.from("epc_power_checks").upsert(toCheckRow(check));
  if (checkError) throw checkError;

  const { error: deleteEnginesError } = await db
    .from("epc_power_check_engines")
    .delete()
    .eq("check_id", check.id);
  if (deleteEnginesError) throw deleteEnginesError;

  if (check.engines && check.engines.length > 0) {
    const rows: PowerCheckEngineRow[] = check.engines.map((engine, idx) => ({
      check_id: check.id,
      engine_id: engine.engineId,
      engine_label: engine.engineLabel ?? `ENG ${idx + 1}`,
      engine_values: engine.values,
      engine_result: engine.result ?? null,
      position: idx,
    }));
    const { error: insertEngineError } = await db.from("epc_power_check_engines").insert(rows);
    if (insertEngineError) throw insertEngineError;
  }
}

export async function deleteCheckCloud(id: string): Promise<void> {
  const db = assertDb();
  if (!db) return;
  const { error } = await db.from("epc_power_checks").delete().eq("id", id);
  if (error) throw error;
}

export async function replaceChecksCloud(checks: PowerCheckRecord[]): Promise<void> {
  const db = assertDb();
  if (!db) return;

  const { error: delError } = await db.from("epc_power_checks").delete().neq("id", "");
  if (delError) throw delError;

  if (checks.length === 0) return;
  for (const check of checks) {
    await upsertCheckCloud(check);
  }
}

