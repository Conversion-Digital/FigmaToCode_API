import { tailwindMain } from "../tailwind/tailwindMain";
import { Node } from "../api_types";
import { PluginSettings, Size } from "types";

/**
 * Minimal shape for local usage,
 * partially emulating the structure needed by tailwindMain.
 */
interface ExtendedSceneNode {
  // Basic fields from your minimal node.
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  x: number;
  y: number;
  visible: boolean;
  fills: any[];
  strokes: any[];
  effects: any[];
  parent: string | null;
  layoutMode: "NONE" | "HORIZONTAL" | "VERTICAL";
  layoutWrap: "NO_WRAP" | "WRAP";
  primaryAxisAlignItems: string;
  counterAxisAlignItems: string;
  itemSpacing: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  layoutSizingHorizontal: "FIXED" | "FILL";
  layoutSizingVertical: "FIXED" | "HUG";
  clipsContent: boolean;
  children: ExtendedSceneNode[];

  // Extra fields found in your example:
  scrollBehavior?: string; // e.g., "SCROLLS"
  blendMode?: string; // e.g., "PASS_THROUGH"
  background?: any[]; // array of background fills if any.
  backgroundColor?: { r: number; g: number; b: number; a: number };
  counterAxisSizingMode?: string; // e.g., "FIXED"
  strokeWeight?: number;
  strokeAlign?: string; // e.g., "INSIDE" or "OUTSIDE"
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  absoluteRenderBounds?: { x: number; y: number; width: number; height: number };
  constraints?: { vertical: string; horizontal: string };
  layoutAlign?: string; // e.g., "STRETCH"
  layoutGrow?: number;

  // Fields that are relevant for text nodes:
  boundVariables?: Record<string, any>;
  characters?: string;
  characterStyleOverrides?: any[];
  styleOverrideTable?: Record<string, any>;
  lineTypes?: string[];
  lineIndentations?: number[];
  style?: Record<string, any>;
  layoutVersion?: number;
  styles?: Record<string, any>;
  interactions?: any[];
}

// For backward compatibility with code using MinimalSceneNode.
type MinimalSceneNode = ExtendedSceneNode;

/**
 * Minimal settings for Tailwind generation.
 */
function getDefaultTailwindSettings(): PluginSettings {
  return {
    framework: "Tailwind",
    showLayerNames: false,
    useOldPluginVersion2025: false,
    responsiveRoot: true,
    htmlGenerationMode: "html",
    tailwindGenerationMode: "jsx",
    baseFontSize: 16,
    useTailwind4: true,
    roundTailwindValues: true,
    roundTailwindColors: true,
    useColorVariables: false,
    customTailwindPrefix: "",
    embedImages: false,
    embedVectors: false,
    flutterGenerationMode: "snippet",
    swiftUIGenerationMode: "snippet"
  };
}

/**
 * Utility function to parse Figma REST API node JSON into
 * a minimal shape that tailwindMain can handle.
 */
function parseNode(
  node: any,
  parent?: MinimalSceneNode | null
): MinimalSceneNode {
  // Destructure all necessary properties from the node.
  const {
    id,
    name,
    type,
    absoluteBoundingBox,
    visible = true,
    layoutMode,
    primaryAxisAlignItems,
    counterAxisAlignItems,
    itemSpacing,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,
    clipsContent,
    layoutWrap,
    fills = [],
    strokes = [],
    effects = [],
    children,
    layoutSizingHorizontal,
    layoutSizingVertical,
    scrollBehavior,
    blendMode,
    background,
    backgroundColor,
    counterAxisSizingMode,
    strokeWeight,
    strokeAlign,
    absoluteRenderBounds,
    constraints,
    layoutAlign,
    layoutGrow,
    boundVariables,
    characters,
    characterStyleOverrides,
    styleOverrideTable,
    lineTypes,
    lineIndentations,
    style,
    layoutVersion,
    styles,
    interactions
  } = node;

  // Set default width, height, and position from the absoluteBoundingBox if available.
  let width = 0;
  let height = 0;
  let x = 0;
  let y = 0;
  if (absoluteBoundingBox) {
    width = absoluteBoundingBox.width || 0;
    height = absoluteBoundingBox.height || 0;
    x = absoluteBoundingBox.x || 0;
    y = absoluteBoundingBox.y || 0;
  }

  // Create the minimal scene node object.
  const minimal: MinimalSceneNode = {
    // Basic properties
    id,
    name,
    type,
    width,
    height,
    x,
    y,
    visible,
    fills,
    strokes,
    effects,
    parent: parent ? parent.id : null,
    layoutMode: layoutMode || "NONE",
    layoutWrap: layoutWrap || "NO_WRAP",
    primaryAxisAlignItems: primaryAxisAlignItems || "MIN",
    counterAxisAlignItems: counterAxisAlignItems || "MIN",
    itemSpacing: itemSpacing || 0,
    paddingLeft: paddingLeft || 0,
    paddingRight: paddingRight || 0,
    paddingTop: paddingTop || 0,
    paddingBottom: paddingBottom || 0,
    layoutSizingHorizontal: layoutSizingHorizontal || "FIXED",
    layoutSizingVertical: layoutSizingVertical || "FIXED",
    clipsContent: clipsContent || false,
    children: [],

    // Extended properties
    scrollBehavior: scrollBehavior || "SCROLLS",
    blendMode: blendMode || "PASS_THROUGH",
    background: background || [],
    backgroundColor: backgroundColor || { r: 0, g: 0, b: 0, a: 0 },
    counterAxisSizingMode: counterAxisSizingMode || "FIXED",
    strokeWeight: strokeWeight || 1.0,
    strokeAlign: strokeAlign || "INSIDE",
    absoluteBoundingBox: absoluteBoundingBox || { x: 0, y: 0, width: 0, height: 0 },
    absoluteRenderBounds: absoluteRenderBounds || { x: 0, y: 0, width: 0, height: 0 },
    constraints: constraints || { vertical: "TOP", horizontal: "LEFT" },
    layoutAlign: layoutAlign || "STRETCH",
    layoutGrow: layoutGrow || 0,

    // Text-specific properties (if applicable)
    boundVariables: boundVariables || {},
    characters: characters || "",
    characterStyleOverrides: characterStyleOverrides || [],
    styleOverrideTable: styleOverrideTable || {},
    lineTypes: lineTypes || [],
    lineIndentations: lineIndentations || [],
    style: style || {},
    layoutVersion: layoutVersion || 0,
    styles: styles || {},
    interactions: interactions || []
  };

  // Recursively parse children if any.
  if (Array.isArray(children) && children.length > 0) {
    const parsedChildren: MinimalSceneNode[] = [];
    for (const c of children) {
      const childNode = parseNode(c, minimal);
      // Filter out invisible nodes.
      if (childNode.visible !== false) {
        parsedChildren.push(childNode);
      }
    }
    minimal.children = parsedChildren;
  } else {
    minimal.children = [];
  }

  return minimal;
}

/**
 * Generate Tailwind v4 code from an external Figma file + node IDs
 * using Figma's REST API. This is a minimal approach which doesn't
 * replicate all plugin-based logic, but is enough to produce code
 * from node data.
 *
 * @param figmaApiKey   - Figma API personal token.
 * @param fileId        - The Figma file ID.
 * @param nodeIds       - Comma separated string of node IDs to fetch (and convert).
 * @returns A promise string containing the generated code.
 */
export async function generateTailwindv4FromFigma(
  figmaApiKey: string,
  fileId: string,
  nodeIds: string
): Promise<string> {
  if (!figmaApiKey || !fileId || !nodeIds || nodeIds.trim().length === 0) {
    throw new Error("Missing required parameters for generating Tailwind code.");
  }
  const baseUrl = `https://api.figma.com/v1/files/${fileId}/nodes`;
  const url = new URL(baseUrl);
  url.searchParams.append("ids", nodeIds);
  url.searchParams.append("geometry", "paths");
  const finalApiUrl = url.toString();
  console.log("[generateTailwindv4FromFigma] calling", finalApiUrl);
  const response = await fetch(finalApiUrl, {
    method: "GET",
    headers: {
      "X-Figma-Token": figmaApiKey
    }
  });

  if (!response.ok) {
    console.log("[generateTailwindv4FromFigma] API call failed");
    throw new Error(
      `[185] Figma API responded with HTTP ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (!data.nodes) {
    console.log("[generateTailwindv4FromFigma] No nodes found in API response");
    throw new Error("No nodes found in Figma API response");
  }

  // Parse the nodes from the API response.
  // Each node is in data.nodes[nodeId].document. Assume nodeIds is a comma-separated string.
  const convertedSceneNodes: MinimalSceneNode[] = [];
  const nodeIdsList = nodeIds.split(",").map((id) => id.trim());
  for (const nodeId of nodeIdsList) {
    const nodeIdFixed = nodeId.replace("-", ":");
    const doc = data.nodes[nodeIdFixed]?.document;
    if (!doc) {
      console.log(`[generateTailwindv4FromFigma] No document found for node ID ${nodeIdFixed}`);
      continue;
    }
    const parsed = parseNode(doc, null);
    convertedSceneNodes.push(parsed);
  }
  console.log(`[generateTailwindv4FromFigma] Parsed ${convertedSceneNodes.length} scene nodes`);

  // Pass the parsed nodes to tailwindMain with Tailwind v4 settings.
  const tailwindSettings = getDefaultTailwindSettings();
  let finalCode = "";
  for (const topNode of convertedSceneNodes) {
    let codeFragment = "";
    try {
      // tailwindMain expects an array of SceneNode-like objects.
      codeFragment = await tailwindMain([topNode] as any, tailwindSettings);
    } catch (e) {
      console.log("[generateTailwindv4FromFigma] Exception in tailwindMain", e);
    }
    finalCode += codeFragment + "\n";
  }
  return finalCode.trim();
}
