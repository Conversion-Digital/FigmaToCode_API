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

export let localTailwindSettings: PluginSettings;
let previousExecutionCache: {
  style: string;
  text: string;
  openTypeFeatures: Record<string, boolean>;
}[] = [];
const SELF_CLOSING_TAGS = ["img"];

export const tailwindMain = async (
  sceneNode: Array<SceneNode>,
  settings: PluginSettings,
): Promise<string> => {
  // console.log("tailwindMain: Starting code generation for sceneNode", sceneNode);
  localTailwindSettings = settings;
  previousExecutionCache = [];

  let result = await tailwindWidgetGenerator(sceneNode, settings);
  // console.log("tailwindMain[29]: Raw generated result:");

  // Remove the initial newline that is made in Container
  if (result.startsWith("\n")) {
    result = result.slice(1);
    console.log("tailwindMain[34]: Removed leading newline, updated result:");
  }

  console.log("tailwindMain[37]: Finished code generation, returning result");
  return result;
};

const tailwindWidgetGenerator = async (
  sceneNode: ReadonlyArray<SceneNode>,
  settings: TailwindSettings,
): Promise<string> => {
  // console.log("tailwindWidgetGenerator[45]: Received scene nodes:", sceneNode);
  const visibleNodes = getVisibleNodes(sceneNode);
  // console.log("tailwindWidgetGenerator[47]: Filtered visible nodes:", visibleNodes);
  const promiseOfConvertedCode = visibleNodes.map(convertNode(settings));
  const code = (await Promise.all(promiseOfConvertedCode)).join("");
  // console.log("tailwindWidgetGenerator[50]: Combined converted code:");
  return code;
};

const convertNode =
  (settings: TailwindSettings) =>
  async (node: SceneNode): Promise<string> => {
    // console.log("convertNode[57]: Processing node", node.id, "of type", node.type);
    if (settings.embedVectors && (node as any).canBeFlattened) {
      console.log("convertNode[59]: Node can be flattened and embedVectors is true for", node.id);
      const altNode = await renderAndAttachSVG(node);
      console.log("convertNode[61]: Received altNode:", altNode.id);
      if (altNode.svg) {
        console.log("convertNode[63]: SVG exists for node", node.id, "wrapping SVG now.");
        return tailwindWrapSVG(altNode, settings);
      }
    }

    // console.log("convertName[68]", node.type)
    switch (node.type) {
      case "RECTANGLE":
      case "ELLIPSE":
        // console.log("convertNode: Handling RECTANGLE/ELLIPSE node", node.id);
        return tailwindContainer(node, "", "", settings);
      case "GROUP":
        // console.log("convertNode: Handling GROUP node", node.id);
        return tailwindGroup(node, settings);
      case "FRAME":
      case "COMPONENT":
      case "INSTANCE":
      case "COMPONENT_SET":
        // console.log("convertNode[81]: Handling FRAME/COMPONENT/INSTANCE/COMPONENT_SET node", node.id);
        return tailwindFrame(node, settings);
      case "TEXT":
        // console.log("convertNode[84]: Handling TEXT node", node.id);
        return tailwindText(node, settings);
      case "LINE":
        // console.log("convertNode: Handling LINE node", node.id);
        return tailwindLine(node, settings);
      case "SECTION":
        // console.log("convertNode: Handling SECTION node", node.id);
        return tailwindSection(node, settings);
      case "VECTOR":
        // console.log("convertNode: Handling VECTOR node", node.id);
        if (!settings.embedVectors) {
          addWarning("Vector is not supported");
          // console.log("convertNode: Warning added for VECTOR node", node.id);
        }
        return tailwindContainer(
          { ...node, type: "RECTANGLE" } as any,
          "",
          "",
          settings,
        );
      default:
        addWarning(`${node.type} node is not supported`);
        console.log("convertNode: Node type not supported:", node.type);
    }
    return "";
  };

const tailwindWrapSVG = (
  node: AltNode<SceneNode>,
  settings: TailwindSettings,
): string => {
  console.log("tailwindWrapSVG: Wrapping SVG for node", node.id);
  if (!node.svg) {
    console.log("tailwindWrapSVG: No SVG available for node", node.id);
    return "";
  }
  const builder = new TailwindDefaultBuilder(node, settings)
    .addData("svg-wrapper")
    .position();
  const builtAttributes = builder.build();
  console.log("tailwindWrapSVG: Built attributes for SVG wrapper:", builtAttributes);
  return `\n<div${builtAttributes}>\n${node.svg}</div>`;
};

const tailwindGroup = async (
  node: GroupNode,
  settings: TailwindSettings,
): Promise<string> => {
  // console.log("tailwindGroup: Processing GROUP node", node.id);
  if (node.width < 0 || node.height <= 0 || node.children.length === 0) {
    console.log("tailwindGroup: Group node has invalid dimensions or no children", node.id);
    return "";
  }
  const builder = new TailwindDefaultBuilder(node, settings)
    .blend()
    .size()
    .position();
  // console.log("tailwindGroup: Builder attributes:", builder.attributes, "Style:", builder.style);
  if (builder.attributes || builder.style) {
    const attr = builder.build("");
    // console.log("tailwindGroup[144]: Built attributes:", attr);
    const generator = await tailwindWidgetGenerator(node.children, settings);
    // console.log("tailwindGroup[146]: Generated children code:");
    return `\n<div${attr}>${indentString(generator)}\n</div>`;
  }
  const childrenCode = await tailwindWidgetGenerator(node.children, settings);
  console.log("tailwindGroup: Returning children code for GROUP node:", childrenCode);
  return childrenCode;
};

export const tailwindText = (
  node: TextNode,
  settings: TailwindSettings,
): string => {
  // console.log("tailwindText: Processing TEXT node", node.id);
  const layoutBuilder = new TailwindTextBuilderV2(node, settings)
    .commonPositionStyles()
    .textAlignHorizontal()
    .textAlignVertical();
  const styledHtml = layoutBuilder.getTextSegments(node);
  // console.log("tailwindText: Styled HTML segments:", styledHtml);
  previousExecutionCache.push(...styledHtml);
  let content = "";
  if (styledHtml.length === 1) {
    const segment = styledHtml[0];
    console.log("tailwindText[168] ", segment.style);
    layoutBuilder.addAttributes(segment.style);
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
    // console.log(`tailwindText[181] ${node.id} ${node.name}`, styledHtml);
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
  console.log("tailwindText[192]: Built layout builder attributes:", builtAttributes);
  return `\n<div${builtAttributes}>${content}</div>`;
};

const tailwindFrame = async (
  node: FrameNode | InstanceNode | ComponentNode | ComponentSetNode,
  settings: TailwindSettings,
): Promise<string> => {
  // console.log("tailwindFrame[200]: Processing frame-like node", node.id);
  const childrenStr = await tailwindWidgetGenerator(node.children, settings);
  // console.log("tailwindFrame[202]: Generated children string:");
  const clipsContentClass =
    node.clipsContent && "children" in node && node.children.length > 0
      ? "overflow-hidden"
      : "";
  let layoutProps = "";
  if (node.layoutMode !== "NONE") {
    layoutProps = tailwindAutoLayoutProps(node, node);
    // console.log("tailwindFrame[210]: Layout properties from auto layout:", layoutProps);
  }
  const combinedProps = [layoutProps, clipsContentClass]
    .filter(Boolean)
    .join(" ");
  // console.log("tailwindFrame[215]: Combined properties for frame:", combinedProps);
  const containREsult= tailwindContainer(node, childrenStr, combinedProps, settings);
  // console.log("tailwindFrame[217]: tailwindFrame call complete");
  return containREsult;
};

export const tailwindContainer = (
  node: SceneNode &
    SceneNodeMixin &
    BlendMixin &
    LayoutMixin &
    GeometryMixin &
    MinimalBlendMixin,
  children: string,
  additionalAttr: string,
  settings: TailwindSettings,
): string => {
  // console.log("tailwindContainer[230]: Processing container node", node.id);
  if (node.width < 0 || node.height < 0) {
    console.log("tailwindContainer[232]: Node has invalid dimensions, returning children for node", node.id);
    return children;
  }
  const builder = new TailwindDefaultBuilder(node, settings)
    .commonPositionStyles()
    .commonShapeStyles();
  if (!builder.attributes && !additionalAttr) {
    console.log("tailwindContainer[239]: Builder has no attributes, returning children for node", node.id);
    return children;
  }
  const build = builder.build(additionalAttr);
  // console.log("tailwindContainer[243]: Built attributes:", build);
  let tag = "div";
  let src = "";
  const topFill = retrieveTopFill(node.fills);
  // console.log("tailwindContainer[247]");
  if (topFill?.type === "IMAGE") {
    addWarning("Image fills are replaced with placeholders");
    // console.log("tailwindContainer[250]");
    const imageURL = getPlaceholderImage(node.width, node.height);
    if (!("children" in node) || node.children.length === 0) {
      tag = "img";
      src = ` src="${imageURL}"`;
      // console.log("tailwindContainer[254]: Using img tag with src", imageURL);
    } else {
      builder.addAttributes(`bg-[url(${imageURL})]`);
      // console.log("tailwindContainer[257]: Added background image attribute", imageURL);
    }
  }
  if (children) {
    const container = `\n<${tag}${build}${src}>${indentString(children)}\n</${tag}>`;
    // console.log("tailwindContainer[261]: Returning container with children:");
    return container;
  } else if (
    SELF_CLOSING_TAGS.includes(tag) ||
    settings.tailwindGenerationMode === "jsx"
  ) {
    const container = `\n<${tag}${build}${src} />`;
    // console.log("tailwindContainer[268]: Returning self-closing container:");
    return container;
  } else {
    const container = `\n<${tag}${build}${src}></${tag}>`;
    // console.log("tailwindContainer[272]: Returning container without children:");
    return container;
  }
};

export const tailwindLine = (
  node: LineNode,
  settings: TailwindSettings,
): string => {
  console.log("tailwindLine[283]: Processing LINE node", node.id);
  const builder = new TailwindDefaultBuilder(node, settings)
    .commonPositionStyles()
    .commonShapeStyles();
  const lineContainer = `\n<div${builder.build()}></div>`;
  console.log("tailwindLine[288]: Generated line container:", lineContainer);
  return lineContainer;
};

export const tailwindSection = async (
  node: SectionNode,
  settings: TailwindSettings,
): Promise<string> => {
  console.log("tailwindSection[294]: Processing SECTION node", node.id);
  const childrenStr = await tailwindWidgetGenerator(node.children, settings);
  const builder = new TailwindDefaultBuilder(node, settings)
    .size()
    .position()
    .customColor(node.fills, "bg");
  const build = builder.build();
  const sectionContainer = childrenStr
    ? `\n<div${build}>${indentString(childrenStr)}\n</div>`
    : `\n<div${build}></div>`;
  console.log("tailwindSection[306]: Generated section container:", sectionContainer);
  return sectionContainer;
};

export const tailwindCodeGenTextStyles = (): string => {
  if (previousExecutionCache.length === 0) {
    console.log("tailwindCodeGenTextStyles[312]: No text styles found");
    return "// No text styles in this selection";
  }
  const codeStyles = previousExecutionCache
    .map((style) => `// ${style.text}\n${style.style.split(" ").join("\n")}`)
    .join("\n---\n");
  console.log("tailwindCodeGenTextStyles[318]: Generated text style code:", codeStyles);
  return codeStyles;
};