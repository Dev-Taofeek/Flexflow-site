const EMAILJS_SEND_URL = "https://api.emailjs.com/api/v1.0/email/send";

function getEmailConfig() {
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY || process.env.EMAILJS_USER_ID;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY || process.env.EMAILJS_ACCESS_TOKEN;

    if (!serviceId || !templateId || !publicKey) {
        return null;
    }

    return { serviceId, templateId, publicKey, privateKey };
}

export function isEmailConfigured() {
    return Boolean(getEmailConfig());
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
