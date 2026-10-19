// Generated contract for strict AgentKit mapping.
export const contract: Record<string, any> = {
    Contract_VariableDefinitions: {
        type: "object",
        propertyNames: {
            pattern: "^[a-z][a-z0-9_]{0,63}$",
        },
        additionalProperties: {
            $ref: "#/components/schemas/Contract_VariableDefinition",
        },
        description: "Variable definitions keyed by name.",
    },
    Contract_ModelCredential: {
        oneOf: [
            {
                type: "object",
                properties: {
                    mode: {
                        type: "string",
                        const: "byok",
                    },
                    api_key: {
                        type: "string",
                        minLength: 1,
                        writeOnly: true,
                        description: "Provider API key or a $secrets.<set>.<key> reference.",
                    },
                },
                required: ["mode", "api_key"],
                additionalProperties: false,
            },
            {
                type: "object",
                properties: {
                    mode: {
                        type: "string",
                        const: "managed",
                    },
                },
                required: ["mode"],
                additionalProperties: false,
            },
        ],
        discriminator: {
            propertyName: "mode",
        },
        description:
            "Provider authentication. BYOK uses the customer-supplied API key; managed uses authentication provisioned by Agora.",
    },
    Contract_Llm: {
        type: "object",
        properties: {
            credential: {
                $ref: "#/components/schemas/Contract_ModelCredential",
            },
            url: {
                type: "string",
                format: "uri",
                description:
                    "Use only the fixed endpoint approved for the selected LLM vendor in managed or BYOK mode. Other endpoints are deferred until runtime SSRF and DNS-rebinding controls are available.",
            },
            vendor: {
                type: "string",
            },
            style: {
                type: "string",
            },
            model: {
                type: "string",
            },
            params: {
                type: "object",
                additionalProperties: true,
                description:
                    "Set credential.mode to byok and provide credential.api_key to use customer-supplied authentication, or set it to managed to use authentication provisioned by Agora. Keep non-secret provider settings in params. This rule applies independently to ASR, LLM, TTS, avatar, and realtime MLLM modules.",
                "x-runtime-mutable": true,
            },
            input_modalities: {
                type: "array",
                items: {
                    type: "string",
                },
            },
            output_modalities: {
                type: "array",
                items: {
                    type: "string",
                },
            },
            max_history: {
                type: "integer",
                minimum: 1,
                maximum: 1024,
                default: 32,
                description:
                    "Number of recent conversation messages retained for LLM context, 1-1024, matching V2. Agent instructions are unaffected.",
            },
            failure_message: {
                type: "string",
                description:
                    "Message spoken through TTS when the LLM fails. No fallback message is implied when omitted.",
            },
            mcp_servers: {
                type: "array",
                items: {
                    $ref: "#/components/schemas/Contract_McpServer",
                },
                description: "Deferred until runtime endpoint and authentication controls are available.",
                "x-api-availability": "deferred",
            },
            tools: {
                type: "array",
                items: {
                    $ref: "#/components/schemas/Contract_FunctionTool",
                },
                maxItems: 32,
                description: "Deferred until runtime callback SSRF and authentication controls are available.",
                "x-api-availability": "deferred",
            },
            headers: {
                type: "object",
                additionalProperties: {
                    type: "string",
                },
                writeOnly: true,
                description: "Deferred with custom provider destinations.",
                "x-api-availability": "deferred",
            },
        },
        additionalProperties: false,
        description:
            "Set credential.mode to byok and provide credential.api_key to use customer-supplied authentication, or set it to managed to use authentication provisioned by Agora. Keep non-secret provider settings in params. This rule applies independently to ASR, LLM, TTS, avatar, and realtime MLLM modules.",
    },
    Contract_CascadedPipeline: {
        type: "object",
        properties: {
            mode: {
                type: "string",
                const: "cascaded",
            },
            avatar: {
                $ref: "#/components/schemas/Contract_Avatar",
            },
            turn_detection: {
                $ref: "#/components/schemas/Contract_TurnDetection",
            },
            asr: {
                $ref: "#/components/schemas/Contract_Asr",
            },
            tts: {
                $ref: "#/components/schemas/Contract_Tts",
            },
            llm: {
                $ref: "#/components/schemas/Contract_Llm",
            },
            silence_config: {
                $ref: "#/components/schemas/Contract_SilenceConfig",
            },
        },
        required: ["mode"],
        additionalProperties: false,
    },
    Contract_Pipeline: {
        oneOf: [
            {
                $ref: "#/components/schemas/Contract_CascadedPipeline",
            },
            {
                $ref: "#/components/schemas/Contract_RealtimePipeline",
            },
        ],
        discriminator: {
            propertyName: "mode",
        },
    },
    Contract_SemanticVadTurnDetection: {
        type: "object",
        properties: {
            type: {
                type: "string",
                const: "semantic_vad",
            },
            eagerness: {
                type: "string",
                enum: ["auto", "low", "medium", "high"],
            },
        },
        required: ["type"],
        additionalProperties: false,
    },
    Contract_SilenceConfig: {
        type: "object",
        properties: {
            enabled: {
                type: "boolean",
            },
            timeout_ms: {
                type: "integer",
            },
            action: {
                type: "string",
                enum: ["speak", "think"],
            },
            content: {
                type: "string",
            },
        },
        required: ["enabled", "timeout_ms", "action", "content"],
        additionalProperties: false,
    },
    Contract_ServerVadTurnDetection: {
        type: "object",
        properties: {
            type: {
                type: "string",
                const: "server_vad",
            },
            prefix_padding_ms: {
                type: "integer",
                minimum: 0,
            },
            silence_duration_ms: {
                type: "integer",
                minimum: 0,
            },
            threshold: {
                type: "number",
                minimum: 0,
                maximum: 1,
                description: "OpenAI Realtime API only.",
            },
            idle_timeout_ms: {
                type: "integer",
                minimum: 0,
                description: "OpenAI Realtime API only.",
            },
            start_of_speech_sensitivity: {
                type: "string",
                enum: ["START_SENSITIVITY_HIGH", "START_SENSITIVITY_LOW"],
                description: "Gemini Live only.",
            },
            end_of_speech_sensitivity: {
                type: "string",
                enum: ["END_SENSITIVITY_HIGH", "END_SENSITIVITY_LOW"],
                description: "Gemini Live only.",
            },
        },
        required: ["type"],
        additionalProperties: false,
    },
    Contract_McpServer: {
        type: "object",
        "x-api-availability": "deferred",
        properties: {
            name: {
                type: "string",
                pattern: "^[a-zA-Z0-9]{1,48}$",
            },
            endpoint: {
                type: "string",
                format: "uri",
            },
            transport: {
                type: "string",
                const: "streamable_http",
            },
            headers: {
                type: "object",
                additionalProperties: {
                    type: "string",
                },
                writeOnly: true,
            },
            allowed_tools: {
                type: "array",
                items: {
                    type: "string",
                    minLength: 1,
                },
                uniqueItems: true,
            },
            timeout_ms: {
                type: "integer",
                minimum: 1000,
                maximum: 100000,
            },
        },
        required: ["name", "endpoint", "transport"],
        additionalProperties: false,
    },
    Contract_VariableDefinition: {
        type: "object",
        properties: {
            type: {
                type: "string",
                enum: ["str", "int", "float", "bool", "date", "datetime"],
            },
            required: {
                type: "boolean",
                default: false,
            },
            options: {
                type: "array",
                items: {
                    type: ["string", "number", "boolean"],
                },
                minItems: 1,
                maxItems: 100,
                uniqueItems: true,
            },
            extract: {
                type: "boolean",
                default: false,
            },
            description: {
                type: "string",
                maxLength: 2000,
            },
        },
        required: ["type"],
        additionalProperties: false,
        allOf: [
            {
                if: {
                    properties: {
                        extract: {
                            const: true,
                        },
                    },
                    required: ["extract"],
                },
                then: {
                    required: ["description"],
                },
            },
        ],
        description:
            "One template variable. extract: true also fills it from the transcript after the session ends; description is then the extraction instruction.",
    },
    Contract_Greeting: {
        oneOf: [
            {
                type: "object",
                properties: {
                    mode: {
                        type: "string",
                        const: "text",
                    },
                    on: {
                        type: "string",
                        enum: ["each_join", "first_join"],
                    },
                    delay_ms: {
                        type: "integer",
                        minimum: 0,
                        maximum: 5000,
                        default: 0,
                    },
                    text: {
                        type: "string",
                    },
                },
                required: ["mode", "text"],
                additionalProperties: false,
            },
            {
                type: "object",
                properties: {
                    mode: {
                        type: "string",
                        const: "audio",
                    },
                    on: {
                        type: "string",
                        enum: ["each_join", "first_join"],
                    },
                    delay_ms: {
                        type: "integer",
                        minimum: 0,
                        maximum: 5000,
                        default: 0,
                    },
                    url: {
                        type: "string",
                        format: "uri",
                        maxLength: 2048,
                    },
                    text: {
                        type: "string",
                        minLength: 1,
                    },
                    download_timeout_ms: {
                        type: "integer",
                        minimum: 200,
                        maximum: 10000,
                        default: 1000,
                    },
                    pcm_sample_rate: {
                        type: "integer",
                        minimum: 1,
                        default: 16000,
                    },
                },
                required: ["mode", "url", "text"],
                additionalProperties: false,
            },
        ],
        discriminator: {
            propertyName: "mode",
        },
    },
    Contract_Asr: {
        type: "object",
        properties: {
            credential: {
                $ref: "#/components/schemas/Contract_ModelCredential",
            },
            url: {
                type: "string",
                format: "uri",
                description:
                    "Use only the fixed endpoint approved for the selected ASR vendor in managed or BYOK mode. Other endpoints are deferred until runtime SSRF and DNS-rebinding controls are available.",
            },
            vendor: {
                type: "string",
            },
            model: {
                type: "string",
            },
            language: {
                type: "string",
            },
            params: {
                type: "object",
                additionalProperties: true,
                description:
                    "Set credential.mode to byok and provide credential.api_key to use customer-supplied authentication, or set it to managed to use authentication provisioned by Agora. Keep non-secret provider settings in params. This rule applies independently to ASR, LLM, TTS, avatar, and realtime MLLM modules.",
            },
        },
        additionalProperties: false,
        description:
            "Set credential.mode to byok and provide credential.api_key to use customer-supplied authentication, or set it to managed to use authentication provisioned by Agora. Keep non-secret provider settings in params. This rule applies independently to ASR, LLM, TTS, avatar, and realtime MLLM modules.",
    },
    Contract_FillerWords: {
        type: "object",
        properties: {
            enable: {
                type: "boolean",
            },
            trigger: {
                type: "object",
                properties: {
                    mode: {
                        type: "string",
                        const: "fixed_time",
                    },
                    response_wait_ms: {
                        type: "integer",
                        minimum: 100,
                        maximum: 10000,
                        default: 1500,
                    },
                },
                required: ["mode", "response_wait_ms"],
                additionalProperties: false,
            },
            content: {
                oneOf: [
                    {
                        type: "object",
                        properties: {
                            mode: {
                                type: "string",
                                const: "static",
                            },
                            phrases: {
                                type: "array",
                                items: {
                                    type: "string",
                                    minLength: 1,
                                },
                                minItems: 1,
                                maxItems: 100,
                            },
                            selection_rule: {
                                type: "string",
                                enum: ["shuffle", "round_robin"],
                                default: "shuffle",
                            },
                        },
                        required: ["mode", "phrases"],
                        additionalProperties: false,
                    },
                    {
                        type: "object",
                        properties: {
                            mode: {
                                type: "string",
                                const: "generated",
                            },
                            instructions: {
                                type: "string",
                            },
                            fallback_strategy: {
                                type: "string",
                                enum: ["static"],
                            },
                        },
                        required: ["mode", "instructions"],
                        additionalProperties: false,
                    },
                ],
                discriminator: {
                    propertyName: "mode",
                },
            },
        },
        additionalProperties: false,
    },
    Contract_Interruption: {
        oneOf: [
            {
                type: "object",
                properties: {
                    mode: {
                        type: "string",
                        const: "start_of_speech",
                    },
                },
                required: ["mode"],
                additionalProperties: false,
            },
            {
                type: "object",
                properties: {
                    mode: {
                        type: "string",
                        const: "keywords",
                    },
                    keywords: {
                        type: "array",
                        items: {
                            type: "string",
                            minLength: 1,
                        },
                        minItems: 1,
                        maxItems: 128,
                    },
                },
                required: ["mode", "keywords"],
                additionalProperties: false,
            },
            {
                type: "object",
                properties: {
                    mode: {
                        type: "string",
                        const: "off",
                    },
                    when_off: {
                        type: "string",
                        enum: ["append", "ignore"],
                        default: "append",
                    },
                },
                required: ["mode"],
                additionalProperties: false,
            },
        ],
        discriminator: {
            propertyName: "mode",
        },
        default: {
            mode: "start_of_speech",
        },
    },
    Contract_TurnStart: {
        oneOf: [
            {
                type: "object",
                properties: {
                    type: {
                        type: "string",
                        const: "semantic",
                        default: "semantic",
                    },
                    speaking_interrupt_duration_ms: {
                        type: "integer",
                        default: 160,
                    },
                },
                required: ["type"],
                additionalProperties: false,
            },
            {
                type: "object",
                properties: {
                    type: {
                        type: "string",
                        const: "vad",
                    },
                    interrupt_duration_ms: {
                        type: "integer",
                        default: 160,
                    },
                    speaking_interrupt_duration_ms: {
                        type: "integer",
                        default: 160,
                    },
                    prefix_padding_ms: {
                        type: "integer",
                        default: 800,
                    },
                },
                required: ["type"],
                additionalProperties: false,
            },
            {
                type: "object",
                properties: {
                    type: {
                        type: "string",
                        const: "manual",
                    },
                },
                required: ["type"],
                additionalProperties: false,
            },
        ],
        discriminator: {
            propertyName: "type",
        },
    },
    Contract_FunctionTool: {
        type: "object",
        "x-api-availability": "deferred",
        properties: {
            type: {
                type: "string",
                const: "function",
            },
            name: {
                type: "string",
                pattern: "^(?![mM][cC][pP])[a-zA-Z][a-zA-Z0-9]{0,63}$",
            },
            description: {
                type: "string",
                minLength: 1,
                maxLength: 1024,
            },
            parameters: {
                $ref: "#/components/schemas/Contract_JsonSchema",
            },
            execution: {
                $ref: "#/components/schemas/Contract_FunctionToolExecution",
            },
            server: {
                $ref: "#/components/schemas/Contract_FunctionToolServer",
            },
        },
        required: ["type", "name", "description", "parameters", "execution", "server"],
        additionalProperties: false,
    },
    Contract_Tts: {
        type: "object",
        properties: {
            credential: {
                $ref: "#/components/schemas/Contract_ModelCredential",
            },
            url: {
                type: "string",
                format: "uri",
                description:
                    "Use only the fixed endpoint approved for the selected TTS vendor in managed or BYOK mode. Other endpoints are deferred until runtime SSRF and DNS-rebinding controls are available.",
            },
            headers: {
                type: "object",
                additionalProperties: {
                    type: "string",
                },
                writeOnly: true,
                description: "Deferred with custom provider destinations.",
                "x-api-availability": "deferred",
            },
            vendor: {
                type: "string",
            },
            params: {
                type: "object",
                additionalProperties: true,
                description:
                    "Set credential.mode to byok and provide credential.api_key to use customer-supplied authentication, or set it to managed to use authentication provisioned by Agora. Keep non-secret provider settings in params. This rule applies independently to ASR, LLM, TTS, avatar, and realtime MLLM modules.",
            },
            skip_patterns: {
                type: "array",
                items: {
                    type: "string",
                    enum: [
                        "fullwidth_parentheses",
                        "lenticular_brackets",
                        "parentheses",
                        "square_brackets",
                        "curly_braces",
                    ],
                },
                uniqueItems: true,
            },
        },
        additionalProperties: false,
        description:
            "Set credential.mode to byok and provide credential.api_key to use customer-supplied authentication, or set it to managed to use authentication provisioned by Agora. Keep non-secret provider settings in params. This rule applies independently to ASR, LLM, TTS, avatar, and realtime MLLM modules.",
    },
    Contract_RealtimePipeline: {
        type: "object",
        properties: {
            mode: {
                type: "string",
                const: "realtime",
            },
            avatar: {
                $ref: "#/components/schemas/Contract_Avatar",
            },
            turn_detection: {
                $ref: "#/components/schemas/Contract_RealtimeTurnDetection",
            },
            mllm: {
                $ref: "#/components/schemas/Contract_Mllm",
            },
        },
        required: ["mode"],
        additionalProperties: false,
    },
    Contract_Mllm: {
        type: "object",
        properties: {
            credential: {
                $ref: "#/components/schemas/Contract_ModelCredential",
            },
            vendor: {
                type: "string",
            },
            model: {
                type: "string",
            },
            url: {
                type: "string",
                format: "uri",
                description: "Deferred until runtime SSRF and DNS-rebinding controls are available.",
                "x-api-availability": "deferred",
            },
            params: {
                type: "object",
                additionalProperties: true,
                description:
                    "Set credential.mode to byok and provide credential.api_key to use customer-supplied authentication, or set it to managed to use authentication provisioned by Agora. Keep non-secret provider settings in params. This rule applies independently to ASR, LLM, TTS, avatar, and realtime MLLM modules.",
                "x-runtime-mutable": true,
            },
            input_modalities: {
                type: "array",
                items: {
                    type: "string",
                    enum: ["text", "audio"],
                },
            },
            output_modalities: {
                type: "array",
                items: {
                    type: "string",
                    enum: ["text", "audio"],
                },
            },
            mcp_servers: {
                type: "array",
                items: {
                    $ref: "#/components/schemas/Contract_McpServer",
                },
                description: "Deferred until runtime endpoint and authentication controls are available.",
                "x-api-availability": "deferred",
            },
            headers: {
                type: "object",
                additionalProperties: {
                    type: "string",
                },
                writeOnly: true,
                description: "Deferred with custom provider destinations.",
                "x-api-availability": "deferred",
            },
        },
        required: ["vendor"],
        additionalProperties: false,
        description:
            "Set credential.mode to byok and provide credential.api_key to use customer-supplied authentication, or set it to managed to use authentication provisioned by Agora. Keep non-secret provider settings in params. This rule applies independently to ASR, LLM, TTS, avatar, and realtime MLLM modules.",
    },
    Contract_Avatar: {
        type: "object",
        properties: {
            enabled: {
                type: "boolean",
                default: false,
            },
            credential: {
                $ref: "#/components/schemas/Contract_ModelCredential",
            },
            vendor: {
                type: "string",
                enum: ["akool", "liveavatar", "anam", "generic"],
            },
            params: {
                type: "object",
                additionalProperties: true,
                description:
                    "Set credential.mode to byok and provide credential.api_key to use customer-supplied authentication, or set it to managed to use authentication provisioned by Agora. Keep non-secret provider settings in params. This rule applies independently to ASR, LLM, TTS, avatar, and realtime MLLM modules.",
            },
        },
        additionalProperties: false,
        description:
            "Set credential.mode to byok and provide credential.api_key to use customer-supplied authentication, or set it to managed to use authentication provisioned by Agora. Keep non-secret provider settings in params. This rule applies independently to ASR, LLM, TTS, avatar, and realtime MLLM modules.",
    },
    Contract_RealtimeTurnDetection: {
        oneOf: [
            {
                $ref: "#/components/schemas/Contract_AgoraVadTurnDetection",
            },
            {
                $ref: "#/components/schemas/Contract_ServerVadTurnDetection",
            },
            {
                $ref: "#/components/schemas/Contract_SemanticVadTurnDetection",
            },
        ],
        discriminator: {
            propertyName: "type",
        },
    },
    Contract_FunctionToolServer: {
        type: "object",
        properties: {
            method: {
                type: "string",
                enum: ["GET", "POST"],
            },
            url: {
                type: "string",
                format: "uri",
                pattern: "^https://",
            },
            headers: {
                type: "object",
                additionalProperties: {
                    type: "string",
                },
                writeOnly: true,
            },
            body: {
                type: "object",
                additionalProperties: true,
            },
            timeout_ms: {
                type: "integer",
                minimum: 1000,
                maximum: 100000,
                default: 10000,
            },
        },
        required: ["method", "url"],
        additionalProperties: false,
    },
    Contract_TurnEnd: {
        oneOf: [
            {
                type: "object",
                properties: {
                    type: {
                        type: "string",
                        const: "semantic",
                        default: "semantic",
                    },
                    silence_duration_ms: {
                        type: "integer",
                        minimum: 120,
                        maximum: 2000,
                        default: 320,
                    },
                    max_wait_ms: {
                        type: "integer",
                        minimum: 500,
                        maximum: 10000,
                        default: 3000,
                    },
                    pause_state_enabled: {
                        type: "boolean",
                        default: true,
                    },
                },
                required: ["type"],
                additionalProperties: false,
            },
            {
                type: "object",
                properties: {
                    type: {
                        type: "string",
                        const: "vad",
                    },
                    silence_duration_ms: {
                        type: "integer",
                        minimum: 120,
                        maximum: 2000,
                        default: 640,
                    },
                },
                required: ["type"],
                additionalProperties: false,
            },
            {
                type: "object",
                properties: {
                    type: {
                        type: "string",
                        const: "manual",
                    },
                },
                required: ["type"],
                additionalProperties: false,
            },
        ],
        discriminator: {
            propertyName: "type",
        },
    },
    Contract_Message: {
        type: "object",
        properties: {
            role: {
                type: "string",
                enum: ["system", "user", "assistant"],
            },
            content: {
                type: "string",
            },
        },
        required: ["role", "content"],
        additionalProperties: false,
    },
    Contract_AgentCreateInput: {
        type: "object",
        properties: {
            agent_name: {
                type: "string",
            },
            instructions: {
                type: "string",
                "x-runtime-mutable": true,
            },
            messages: {
                type: "array",
                items: {
                    $ref: "#/components/schemas/Contract_Message",
                },
                "x-runtime-mutable": true,
            },
            greeting: {
                $ref: "#/components/schemas/Contract_Greeting",
            },
            variables: {
                $ref: "#/components/schemas/Contract_VariableDefinitions",
            },
            pipeline: {
                $ref: "#/components/schemas/Contract_Pipeline",
            },
            filler_words: {
                $ref: "#/components/schemas/Contract_FillerWords",
            },
        },
        required: ["agent_name"],
        additionalProperties: false,
    },
    Contract_TurnDetection: {
        type: "object",
        properties: {
            speech_threshold: {
                type: "number",
                exclusiveMinimum: 0,
                exclusiveMaximum: 1,
                default: 0.5,
            },
            start_of_speech: {
                $ref: "#/components/schemas/Contract_TurnStart",
            },
            end_of_speech: {
                $ref: "#/components/schemas/Contract_TurnEnd",
            },
            interruption: {
                $ref: "#/components/schemas/Contract_Interruption",
            },
        },
        additionalProperties: false,
    },
    Contract_AgoraVadTurnDetection: {
        type: "object",
        properties: {
            type: {
                type: "string",
                const: "agora_vad",
            },
            interrupt_duration_ms: {
                type: "integer",
                minimum: 0,
            },
            prefix_padding_ms: {
                type: "integer",
                minimum: 0,
            },
            silence_duration_ms: {
                type: "integer",
                minimum: 0,
            },
            threshold: {
                type: "number",
                exclusiveMinimum: 0,
                exclusiveMaximum: 1,
            },
        },
        required: ["type"],
        additionalProperties: false,
    },
    Contract_FunctionToolExecution: {
        type: "object",
        properties: {
            mode: {
                type: "string",
                const: "sync",
            },
        },
        required: ["mode"],
        additionalProperties: false,
    },
    Contract_JsonSchema: {
        type: ["object", "boolean"],
        description: "A JSON Schema (draft 2020-12) document.",
    },
};
