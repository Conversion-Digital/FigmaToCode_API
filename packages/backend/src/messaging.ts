import {
  ConversionMessage,
  ConversionStartMessage,
  EmptyMessage,
  ErrorMessage,
  PluginSettings,
  SettingsChangedMessage,
} from "types";

function getPostMessageFunction() {
  if (typeof figma !== "undefined" && figma.ui && figma.ui.postMessage) {
    return figma.ui.postMessage.bind(figma.ui);
  } else {
    console.warn("figma.ui.postMessage is not available; using fallback stub");
    return (message: any, options?: WindowPostMessageOptions) => {
      console.log("postBackendMessage fallback:", message, options);
    };
  }
}

export const postBackendMessage = getPostMessageFunction();

export const postEmptyMessage = () =>
  postBackendMessage({ type: "empty" } as EmptyMessage);

export const postConversionStart = () =>
  postBackendMessage({ type: "conversionStart" } as ConversionStartMessage);

export const postConversionComplete = (
  conversionData: ConversionMessage | Omit<ConversionMessage, "type">
) => postBackendMessage({ ...conversionData, type: "code" });

export const postError = (error: string) =>
  postBackendMessage({ type: "error", error } as ErrorMessage);

export const postSettingsChanged = (settings: PluginSettings) =>
  postBackendMessage({
    type: "pluginSettingsChanged",
    settings,
  } as SettingsChangedMessage);