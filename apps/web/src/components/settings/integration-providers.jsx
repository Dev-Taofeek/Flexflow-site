export function GitHubIcon({ className = "h-5 w-5" }) {
    return (
        <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
        </svg>
    );
}

export function SlackIcon({ className = "h-5 w-5" }) {
    return (
        <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm6.312 6.312a2.528 2.528 0 0 1 2.522 2.522A2.528 2.528 0 0 1 15.146 15.165a2.528 2.528 0 0 1-2.522-2.52v-2.521h2.522zm0-1.271a2.528 2.528 0 0 1-2.522-2.521 2.528 2.528 0 0 1 2.522-2.521h6.312A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-6.312zm-6.312-6.312A2.528 2.528 0 0 1 15.146 0a2.528 2.528 0 0 1 2.522 2.522v2.52h-2.522zm0 1.271a2.528 2.528 0 0 1-2.522 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v6.312z" />
        </svg>
    );
}

export function FigmaIcon({ className = "h-5 w-5" }) {
    return (
        <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0 0v8a4 4 0 1 1 0-8ZM12 12h4a4 4 0 1 1-4 4v-4Z" />
            <path d="M8 12a4 4 0 1 0 0 8V12Zm4-8v8H8a4 4 0 1 1 0-8h4Z" />
        </svg>
    );
}

export function CustomIcon({ className = "h-5 w-5" }) {
    return (
        <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="13" height="5" rx="1" />
            <rect x="14" y="13" width="7" height="5" rx="1" />
            <path d="M9 11v2a2 2 0 0 0 2 2h3" />
            <path d="M3 17h7" />
        </svg>
    );
}

/**
 * Single source of truth for the connected-provider catalog shared by the
 * Integrations (connection management) and Automations (rules + mappings)
 * settings pages.
 */
export const PROVIDERS = {
    github: {
        feature: "github_integration",
        labelKey: "settings.integrations.githubLabel",
        descKey: "settings.integrations.githubDescription",
        icon: GitHubIcon,
        webhookPath: "/integrations/webhooks/webhooks/github",
        webhookSecretKey: "webhookSecret",
        webhookSecretLabelKey: "settings.integrations.webhookSecretLabel",
        webhookHintKey: "settings.integrations.webhookHintGithub",
        resourceTypes: ["repository", "pull_request", "issue", "check"],
        defaultResourceType: "repository",
        triggerOptions: ["github.pr.opened", "github.pr.merged", "github.pr.review_requested", "github.check"],
        defaultTrigger: "github.pr.opened",
    },
    slack: {
        feature: "slack_integration",
        labelKey: "settings.integrations.slackLabel",
        descKey: "settings.integrations.slackDescription",
        icon: SlackIcon,
        webhookPath: "/integrations/webhooks/webhooks/slack",
        webhookSecretKey: "webhookSigningSecret",
        webhookSecretLabelKey: "settings.integrations.webhookSigningSecretLabel",
        webhookHintKey: "settings.integrations.webhookHintSlack",
        resourceTypes: ["channel"],
        defaultResourceType: "channel",
        triggerOptions: ["slack.message"],
        defaultTrigger: "slack.message",
    },
    figma: {
        feature: "figma_integration",
        labelKey: "settings.integrations.figmaLabel",
        descKey: "settings.integrations.figmaDescription",
        icon: FigmaIcon,
        webhookPath: "/integrations/webhooks/webhooks/figma",
        webhookSecretKey: "webhookPasscode",
        webhookSecretLabelKey: "settings.integrations.webhookPasscodeLabel",
        webhookHintKey: "settings.integrations.webhookHintFigma",
        resourceTypes: ["file"],
        defaultResourceType: "file",
        triggerOptions: ["figma.comment", "figma.file_update", "figma.var_publish"],
        defaultTrigger: "figma.comment",
    },
    // The "custom" provider is managed from the settings/custom-integrations
    // page (incoming token + outbound webhooks); it renders no connector card
    // here, but its events can still power automation rules. Triggers are
    // free-form event names (e.g. "task.created") rather than a fixed list.
    custom: {
        feature: "custom_integrations",
        labelKey: "settings.integrations.customLabel",
        descKey: "settings.integrations.customDescription",
        icon: CustomIcon,
        managedElsewhere: true,
        freeTextTrigger: true,
        triggerOptions: [],
        defaultTrigger: "task.created",
        resourceTypes: [],
        defaultResourceType: "webhook",
    },
};