export interface Msg91TimestampValue {
    value: string;
}

export interface Msg91WhatsAppLogEntry {
    uuid: string;
    requestedAt: string;
    status: string;
    messageType: string;
    direction: number;
    integratedNumber: string;
    customerNumber: string;
    content: string;
    templateName: string;
    templateLanguage: string;
    failureReason: string;
    origin: string;
    telecomCircle: string;
    sentTime: string;
    deliveryTime: string;
    readTime: string;
    statusUpdatedAt: string;
    requestId: string;
    metaErrorCode: string;
}

export interface Msg91WhatsAppLogsResponse {
    data: Msg91WhatsAppLogEntry[];
    total: number;
}
