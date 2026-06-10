const EMAILJS_SEND_URL = "https://api.emailjs.com/api/v1.0/email/send";

function clean(value) {
    return typeof value === "string" ? value.trim() : value;
}

function getEmailConfig() {
    const serviceId = clean(process.env.EMAILJS_SERVICE_ID);
    const templateId = clean(process.env.EMAILJS_TEMPLATE_ID);
    const publicKey = clean(process.env.EMAILJS_PUBLIC_KEY || process.env.EMAILJS_USER_ID);
    const privateKey = clean(process.env.EMAILJS_PRIVATE_KEY || process.env.EMAILJS_ACCESS_TOKEN);

    if (!serviceId || !templateId || !publicKey) {
        return null;
    }

    return { serviceId, templateId, publicKey, privateKey };
}

export function isEmailConfigured() {
    return Boolean(getEmailConfig());
}

export function getEmailConfigStatus() {
    const values = {
        EMAILJS_SERVICE_ID: clean(process.env.EMAILJS_SERVICE_ID),
        EMAILJS_TEMPLATE_ID: clean(process.env.EMAILJS_TEMPLATE_ID),
        EMAILJS_PUBLIC_KEY: clean(process.env.EMAILJS_PUBLIC_KEY || process.env.EMAILJS_USER_ID),
    };

    return {
        configured: Boolean(values.EMAILJS_SERVICE_ID && values.EMAILJS_TEMPLATE_ID && values.EMAILJS_PUBLIC_KEY),
        present: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Boolean(value)])),
        missing: Object.entries(values).filter(([, value]) => !value).map(([key]) => key),
    };
}

export async function sendTransactionalEmail({
    to,
    subject,
    title,
    message,
    actionText,
    actionUrl,
    footer,
}) {
    const config = getEmailConfig();

    if (!config) {
        return { sent: false, error: "EMAILJS_NOT_CONFIGURED" };
    }

    const response = await fetch(EMAILJS_SEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            service_id: config.serviceId,
            template_id: config.templateId,
            user_id: config.publicKey,
            ...(config.privateKey ? { accessToken: config.privateKey } : {}),
            template_params: {
                app_name: "FlexFlow",
                to_email: to,
                subject,
                title,
                message,
                action_text: actionText,
                action_url: actionUrl,
                footer,
            },
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || `EmailJS failed with status ${response.status}`);
    }

    return { sent: true, error: null };
}
