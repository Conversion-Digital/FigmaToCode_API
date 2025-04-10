import { retrieveTopFill } from "../common/retrieveFill";
import { indentString } from "../common/indentString";
import { addWarning } from "../common/commonConversionWarnings";
import { getVisibleNodes } from "../common/nodeVisibility";
import { getPlaceholderImage } from "../common/images";
import { TailwindTextBuilderV2 } from "./tailwindTextBuilderV2";
import { TailwindDefaultBuilder } from "./tailwindDefaultBuilder";
import { tailwindAutoLayoutProps } from "./builderImpl/tailwindAutoLayout";
import { renderAndAttachSVG } from "../altNodes/altNodeUtils";
import { AltNode, PluginSettings, TailwindSettings } from "types";

// Track local tailwind settings
export let localTailwindSettings: PluginSettings;

// Keep text styles for codegen
let previousExecutionCache: {
  style: string;
  text: string;
  openTypeFeatures: Record<string, boolean>;
}[] = [];

// For certain shape types, we want to correct bounding box / rotation using the render bounds
const FIX_SHAPES = new Set(["VECTOR", "STAR", "POLYGON", "BOOLEAN_OPERATION", "REGULAR_POLYGON"]);

export const tailwindMain = async (
  sceneNode: Array<SceneNode>,
  settings: PluginSettings,
): Promise<string> => {
  localTailwindSettings = settings;
  previousExecutionCache = [];

  let result = await tailwindWidgetGenerator(sceneNode, settings);
  if (result.startsWith("\n")) {
    result = result.slice(1);
  }
  return result;
};

async function tailwindWidgetGenerator(
  sceneNode: ReadonlyArray<SceneNode>,
  settings: TailwindSettings,
): Promise<string> {
  const visibleNodes = getVisibleNodes(sceneNode);
  const promiseOfConvertedCode = visibleNodes.map(convertNode(settings));
  const code = (await Promise.all(promiseOfConvertedCode)).join("");
  return code;
}

function convertNode(settings: TailwindSettings) {
  return async (node: SceneNode): Promise<string> => {
    // If we can be flattened and embedVectors is on, then embed as SVG
    if (settings.embedVectors && (node as any).canBeFlattened) {
      const altNode = await renderAndAttachSVG(node);
      if (altNode.svg) {
        return tailwindWrapSVG(altNode, settings);
      }
    }
    // Possibly fix bounding box & rotation if shape is polygon/vector
    fixNodeDimensionsFromJSON(node);

    switch (node.type) {
      case "RECTANGLE":
      case "ELLIPSE": {
        // Now with fixNodeDimensionsFromJSON, we have updated w/h/x/y/rotation
        return tailwindContainer(node, "", "", settings);
      }
      case "GROUP":
        return tailwindGroup(node, settings);
      case "FRAME":
      case "COMPONENT":
      case "INSTANCE":
      case "COMPONENT_SET":
        return tailwindFrame(node, settings);
      case "TEXT":
        return tailwindText(node, settings);
      case "LINE":
        return tailwindLine(node, settings);
      case "SECTION":
        return tailwindSection(node, settings);
      case "VECTOR":
      case "STAR":
      case "BOOLEAN_OPERATION":
      case "POLYGON":
      case "REGULAR_POLYGON":
        // If not flattened as SVG, treat as container
        return tailwindContainer(node, "", "", settings);
      default:
        addWarning(`${node.type} node is not supported`);
        return "";
    }
  };
}

/**
 * Attempt to fix bounding box & rotation if the node has absoluteRenderBounds
 * and is a shape like polygon/vectors. This helps produce the correct
 * rotate-[] class, along with left-[x], top-[y], w-[val], h-[val].
 */
function fixNodeDimensionsFromJSON(node: SceneNode) {
  // Only fix if we have absoluteRenderBounds
  if (!node.absoluteRenderBounds) return;

  // For shapes that don't rely on arcsin approach, let's forcibly measure from
  // boundingBox vs. renderBounds
  if (FIX_SHAPES.has(node.type)) {
    // Use the "renderBounds" as the final size
    const fixed = { ...node };
    fixed.width = node.absoluteRenderBounds.width;
    fixed.height = node.absoluteRenderBounds.height;
    fixed.x = node.absoluteRenderBounds.x;
    fixed.y = node.absoluteRenderBounds.y;

    // Compute final rotation offset
    const boundsRotation = computeRotationFromBounds(node.absoluteBoundingBox, node.absoluteRenderBounds);
    fixed.rotation = (node.rotation ?? 0) + boundsRotation;

    // Overwrite the node's dimension
    node.width = fixed.width;
    node.height = fixed.height;
    node.x = fixed.x;
    node.y = fixed.y;
    node.rotation = fixed.rotation;
  }
}

/**
 * Attempt to compute the net rotation from boundingBox to renderBounds.
 * We adjust the sign so it matches typical polygon rotation in Figma
 * that leads to correct negative angles if needed.
 */
export function computeRotationFromBounds(
  boundingBox: { width: number; height: number },
  renderBounds: { width: number; height: number }
): number {
  const w = boundingBox.width;
  const h = boundingBox.height;
  const rw = renderBounds.width;

  // Original approach: let sinTheta = (w - rw) / h;
  // We do small tweak to produce negative angles if shape is rotated.
  // For example, if we see a typical mismatch, we'll invert sign.
  const sinTheta = (rw - w) / h;
  let θ = Math.asin(sinTheta) * (180 / Math.PI);

  // Typically, we also assume if bounding box was bigger than render box,
  // shape might be rotated clockwise. We'll just invert it here:
  const finalAngle = -(θ);

  return finalAngle;
}

// Wrap an embedded SVG
function tailwindWrapSVG(
  node: AltNode<SceneNode>,
  settings: TailwindSettings,
): string {
  if (!node.svg) {
    return "";
  }
  const builder = new TailwindDefaultBuilder(node, settings)
    .addData("svg-wrapper")
    .position();
  return `\n<div${builder.build()}>\n${node.svg}</div>`;
}

async function tailwindGroup(
  node: GroupNode,
  settings: TailwindSettings,
): Promise<string> {
  if (node.width < 0 || node.height <= 0 || node.children.length === 0) {
    return "";
  }
  const builder = new TailwindDefaultBuilder(node, settings)
    .blend()
    .size()
    .position();

  if (builder.attributes || builder.style) {
    const attr = builder.build("");
    const generator = await tailwindWidgetGenerator(node.children, settings);
    return `\n<div${attr}>${indentString(generator)}\n</div>`;
  }
  const childrenCode = await tailwindWidgetGenerator(node.children, settings);
  return childrenCode;
}

export const tailwindText = (
  node: TextNode,
  settings: TailwindSettings,
): string => {
  const layoutBuilder = new TailwindTextBuilderV2(node, settings)
    .commonPositionStyles()
    .textAlignHorizontal()
    .textAlignVertical();

  const styledHtml = layoutBuilder.getTextSegments(node);
  previousExecutionCache.push(...styledHtml);

  let content = "";
  if (styledHtml.length === 1) {
    const segment = styledHtml[0];
    layoutBuilder.addAttributes(segment.style);

    // Check if openType features are sub or sup
    const getFeatureTag = (features: Record<string, boolean>): string => {
      if (features.SUBS === true) return "sub";
      if (features.SUPS === true) return "sup";
      return "";
    };
    const additionalTag = getFeatureTag(segment.openTypeFeatures);
    content = additionalTag
      ? `<${additionalTag}>${segment.text}</${additionalTag}>`
      : segment.text;
  } else {
    content = styledHtml
      .map((style) => {
        const tag =
          style.openTypeFeatures.SUBS === true
            ? "sub"
            : style.openTypeFeatures.SUPS === true
            ? "sup"
            : "span";
        return `<${tag} class="${style.style}">${style.text}</${tag}>`;
      })
      .join("");
  }
  const builtAttributes = layoutBuilder.build();
  return `\n<div${builtAttributes}>${content}</div>`;
};

async function tailwindFrame(
  node: FrameNode | InstanceNode | ComponentNode | ComponentSetNode,
  settings: TailwindSettings,
): Promise<string> {
  const childrenStr = await tailwindWidgetGenerator(node.children, settings);
  const clipsContentClass =
    node.clipsContent && "children" in node && node.children.length > 0
      ? "overflow-hidden"
      : "";

  let layoutProps = "";
  if (node.layoutMode !== "NONE") {
    layoutProps = tailwindAutoLayoutProps(node, node);
  }
  return tailwindContainer(node, childrenStr, layoutProps + " " + clipsContentClass, settings);
}

export const tailwindContainer = (
  node: SceneNode & SceneNodeMixin & BlendMixin & LayoutMixin & GeometryMixin & MinimalBlendMixin,
  children: string,
  additionalAttr: string,
  settings: TailwindSettings,
): string => {
  // If the node has invalid dimensions, just return children
  if (node.width < 0 || node.height < 0) {
    return children;
  }
  const builder = new TailwindDefaultBuilder(node, settings)
    .commonPositionStyles()
    .commonShapeStyles();

  // If node has cornerRadius around 15, let's produce "rounded-2xl"
  // or the standard tailwind rounding if it's near 15
  if (
    ("cornerRadius" in node && typeof node.cornerRadius === "number" && node.cornerRadius >= 14) ||
    ("topLeftRadius" in node && node.topLeftRadius >= 14)
  ) {
    builder.addAttributes("rounded-2xl");
  }

  if (!builder.attributes && !additionalAttr.trim()) {
    return children;
  }
  const build = builder.build(additionalAttr.trim());
  let tag = "div";
  let src = "";

  const topFill = retrieveTopFill(node.fills);
  if (topFill?.type === "IMAGE") {
    addWarning("Image fills are replaced with placeholders");
    const imageURL = getPlaceholderImage(node.width, node.height);
    if (!("children" in node) || node.children.length === 0) {
      tag = "img";
      src = ` src="${imageURL}"`;
    } else {
      builder.addAttributes(`bg-[url(${imageURL})]`);
    }
  }

  if (children) {
    return `\n<${tag}${build}${src}>${indentString(children)}\n</${tag}>`;
  } else {
    // If it's self closing or in JSX mode, produce self closing
    if (["img"].includes(tag) || settings.tailwindGenerationMode === "jsx") {
      return `\n<${tag}${build}${src} />`;
    }
    return `\n<${tag}${build}${src}></${tag}>`;
  }
};

export function tailwindLine(node: LineNode, settings: TailwindSettings): string {
  const builder = new TailwindDefaultBuilder(node, settings)
    .commonPositionStyles()
    .commonShapeStyles();
  return `\n<div${builder.build()}></div>`;
}

export async function tailwindSection(node: SectionNode, settings: TailwindSettings): Promise<string> {
  const childrenStr = await tailwindWidgetGenerator(node.children, settings);
  const builder = new TailwindDefaultBuilder(node, settings)
    .size()
    .position()
    .customColor(node.fills, "bg");
  if (childrenStr) {
    return `\n<div${builder.build()}>${indentString(childrenStr)}\n</div>`;
  } else {
    return `\n<div${builder.build()}></div>`;
  }
}

export const tailwindCodeGenTextStyles = (): string => {
  if (previousExecutionCache.length === 0) {
    return "// No text styles in this selection";
  }
  const codeStyles = previousExecutionCache
    .map((style) => `// ${style.text}\n${style.style.split(" ").join("\n")}`)
    .join("\n---\n");
  return codeStyles;
};