import { tailwindMain } from "../tailwind/tailwindMain";
import { Node } from "../api_types";
import { PluginSettings, Size } from "types";

/**
 * Minimal shape for local usage,
 * partially emulating the structure needed by tailwindMain.
 */
interface MinimalSceneNode {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  x: number;
  y: number;
  rotation?: number;
  visible?: boolean;
  parent?: MinimalSceneNode | null;
  children?: MinimalSceneNode[];
  fills?: any[];
  strokes?: any[];
  effects?: any[];
  layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL";
  layoutWrap?: "NO_WRAP" | "WRAP";
  primaryAxisAlignItems?: "MIN" | "MAX" | "CENTER" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "MAX" | "CENTER" | "BASELINE";
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  layoutSizingHorizontal?: "FIXED" | "HUG" | "FILL";
  layoutSizingVertical?: "FIXED" | "HUG" | "FILL";
  isRelative?: boolean;
  clipsContent?: boolean;
}

/**
 * Minimal settings for Tailwind generation
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
    children
  } = node;

  // default width/height
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

  const minimal: MinimalSceneNode = {
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
    parent: parent || null,
    layoutMode: layoutMode || "NONE",
    layoutWrap: layoutWrap || "NO_WRAP",
    primaryAxisAlignItems: primaryAxisAlignItems || "MIN",
    counterAxisAlignItems: counterAxisAlignItems || "MIN",
    itemSpacing: itemSpacing || 0,
    paddingLeft: paddingLeft || 0,
    paddingRight: paddingRight || 0,
    paddingTop: paddingTop || 0,
    paddingBottom: paddingBottom || 0,
    layoutSizingHorizontal: "FIXED",
    layoutSizingVertical: "FIXED",
    clipsContent: clipsContent || false,
    children: []
  };

  if (Array.isArray(children) && children.length > 0) {
    const parsedChildren: MinimalSceneNode[] = [];
    for (const c of children) {
      const childNode = parseNode(c, minimal);
      // filter out invisible nodes
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
 * @param figmaApiKey   - Figma API personal token
 * @param fileId        - The Figma file ID
 * @param nodeIds       - Array of node IDs to fetch (and convert)
 * @returns A promise string containing the generated code
 *
 */
export async function generateTailwindv4FromFigma(
  figmaApiKey: string,
  fileId: string,
  nodeIds: string
): Promise<string> {
  if (!figmaApiKey || !fileId || !nodeIds || nodeIds.length === 0) {
    throw new Error("Missing required parameters for generating Tailwind code.");
  }
  const baseUrl = `https://api.figma.com/v1/files/${fileId}/nodes`;
  const url = new URL(baseUrl);
  url.searchParams.append("ids", nodeIds);
  url.searchParams.append("geometry", "paths");
  const finalApiUrl = url.toString();
  console.log("[generateTailwindv4FromFigma] calling one", finalApiUrl);
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Figma-Token": figmaApiKey
    }
  });

  if (!response.ok) {
  console.log("[generateTailwindv4FromFigma] calling 2");
    throw new Error(
      `[185] Figma API responded with HTTP ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (!data.nodes) {
    console.log("[generateTailwindv4FromFigma] calling 3");
    throw new Error("No nodes found in Figma API response");
  }else{
    // console.log(`[generateTailwindv4FromFigma][calling 3aa] data.nodes.length = ${data.nodes}`, data);
  }

  // parse the nodes from the REST response
  // each node is in data.nodes[nodeId].document
  const convertedSceneNodes: MinimalSceneNode[] = [];
  // for (const nodeId of nodeIds) {
    console.log(`[generateTailwindv4FromFigma][calling 3a] nodeId ${nodeIds}`);
    const nodeIdFixed = nodeIds.replace("-", ":");
    const doc = data.nodes[nodeIdFixed]?.document;
    if (!doc) {
      console.log("[generateTailwindv4FromFigma][205] no doc found");
      return "";
    }
    const parsed = parseNode(doc, null);
    convertedSceneNodes.push(parsed);
  // }
  console.log(`[generateTailwindv4FromFigma][calling 4] convertedSceneNodes ${convertedSceneNodes.length}`);

  // pass them to tailwindMain with useTailwind4 = true
  const tailwindSettings = getDefaultTailwindSettings();
  // we transform each top-level node individually
  let finalCode = "";
  for (const topNode of convertedSceneNodes) {
    console.log("[generateTailwindv4FromFigma][calling 5] ");
    // tailwindMain expects an array of SceneNode-likes
    // We can try calling tailwindMain with [topNode] to produce code
    let codeFragment = "";
    try{
      codeFragment = await tailwindMain([topNode] as any, tailwindSettings);
    }catch(e){
      console.log("[generateTailwindv4FromFigma][225] exception", e);
    }

    console.log("[generateTailwindv4FromFigma][calling 5a] ");
    finalCode += codeFragment + "\n";
  }
  console.log("[generateTailwindv4FromFigma][calling 6] ");
  return finalCode.trim();
}


