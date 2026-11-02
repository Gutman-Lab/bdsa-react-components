import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
    stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
    addons: ["@storybook/addon-links", "@storybook/addon-docs", "@storybook/addon-a11y"],

    framework: {
        name: "@storybook/react-vite",
        options: {},
    },

    // Serve static files from public directory (includes bdsa-schema.json)
    staticDirs: ["../public"]
};
export default config;
