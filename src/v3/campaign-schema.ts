// Generated from engineering.openapi.json; see engineering corrections in docs.
export type CallingDay = { weekday: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"; ranges: Array<TimeRange> };
export type CampaignCallPolicy = {
    max_ring_duration_ms?: number | null;
    max_call_duration_seconds?: number | null;
    voicemail?: CampaignVoicemailPolicy | null;
    max_silence_duration_ms?: number | null;
    end_call?: CampaignEndCallPolicy | null;
    transfer?: CampaignTransferPolicy | null;
};
export type CampaignCounts = {
    contacts: number;
    pending: number;
    calling: number;
    completed: number;
    failed: number;
    canceled: number;
};
export type CampaignCreate = {
    name: string;
    agent_id: string;
    transport: CampaignTransport;
    contacts: Array<ContactInput>;
    lifecycle?: CampaignLifecycle;
    pacing?: Pacing;
    schedule: ImmediateSchedule | ScheduledSchedule;
};
export type CampaignDeleteResponse = { deleted?: true };
export type CampaignEndCallPolicy = {
    on_conversation_complete?: boolean;
    on_user_request?: boolean;
    on_fax?: boolean;
    on_ai_assistant?: boolean;
};
export type CampaignFailure = { code: string; provider?: string | null; message: string; ts: number };
export type CampaignLifecycle = { idle_timeout_ms?: number; max_duration_ms?: number; graceful_stop?: GracefulStop };
export type CampaignListData = { count: number; list: Array<CampaignResponse> };
export type CampaignListResponse = { data: CampaignListData; has_more: boolean; next_cursor: string | null };
export type CampaignPatch = {
    lifecycle?: CampaignLifecycle | null;
    pacing?: PacingPatch | null;
    schedule?: (ImmediateSchedule | ScheduledSchedule) | null;
    transport?: CampaignTransportPatch | null;
};
export type CampaignResponse = {
    campaign_id: string;
    name: string;
    status: "scheduled" | "running" | "paused" | "completed" | "canceled" | "failed";
    agent_id: string;
    transport: CampaignTransportResponse;
    lifecycle: CampaignLifecycle;
    schedule: ImmediateSchedule | ScheduledSchedule;
    counts: CampaignCounts;
    create_ts: number;
    start_ts: number | null;
    complete_ts: number | null;
    failure: CampaignFailure | null;
};
export type CampaignTransferPolicy = { phone_number: string; description: string };
export type CampaignTransport = {
    type: "telephony";
    from: string | Array<string>;
    call_policy?: CampaignCallPolicy | null;
};
export type CampaignTransportPatch = { call_policy?: CampaignCallPolicy | null };
export type CampaignTransportResponse = {
    type: "telephony";
    from: Array<string>;
    call_policy?: CampaignCallPolicy | null;
};
export type CampaignVoicemailPolicy = { mode: "continue" | "hangup" };
export type ContactInput = { phone: string; values?: { [key: string]: string | number | number | boolean } };
export type GracefulStop = { enabled?: boolean; timeout_ms?: number };
export type ImmediateSchedule = { mode: "immediate"; timezone?: string; days?: Array<CallingDay> };
export type Pacing = {
    max_concurrent?: number;
    max_calls_per_second?: number | null;
    max_attempts?: number;
    retry_backoff_ms?: number;
};
export type PacingPatch = {
    max_concurrent?: number | null;
    max_calls_per_second?: number | null;
    max_attempts?: number | null;
    retry_backoff_ms?: number | null;
};
export type ScheduledSchedule = {
    mode: "scheduled";
    timezone: string;
    start: string;
    end: string;
    days?: Array<CallingDay>;
};
export type TimeRange = { start: string; end: string };
