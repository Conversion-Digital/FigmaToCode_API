// packages/backend/src/tailwind/tailwindTextBuilderV2.ts

import { TailwindSettings } from "types"
import { TailwindDefaultBuilder } from "./tailwindDefaultBuilder"
import {
  tailwindColorFromFills,
} from "../tailwind/builderImpl/tailwindColor"
import {
  pxToFontSize,
  pxToLetterSpacing,
  pxToLineHeight,
} from "../tailwind/conversionTables"

/**
 * Convert numeric fontWeight to Tailwind font-* class
 */
function mapFontWeight(weight: number): string {
  if (weight <= 100) return "font-thin"
  if (weight <= 200) return "font-extralight"
  if (weight <= 300) return "font-light"
  if (weight <= 400) return "font-normal"
  if (weight <= 500) return "font-medium"
  if (weight <= 600) return "font-semibold"
  if (weight <= 700) return "font-bold"
  if (weight <= 800) return "font-extrabold"
  return "font-black"
}

/**
 * A simple interface for text segments (if multiple style segments are in a single TextNode).
 */
export interface TextSegment {
  style: string
  text: string
  openTypeFeatures: Record<string, boolean>
}

export class TailwindTextBuilderV2 extends TailwindDefaultBuilder {
  private textContent: string

  constructor(node: TextNode, settings: TailwindSettings) {
    super(node, settings)
    this.textContent = node.characters ?? ""
    this.buildStyle()
  }

  /**
   * Build the base set of Tailwind classes for this TextNode.
   * These are added via `this.addAttributes(...)`.
   */
  private buildStyle() {

    const anyJsonNode = this.node as any;

    // 1) Text color
    const textColor = tailwindColorFromFills(anyJsonNode?.fills, "text")
    if (textColor) {
      this.addAttributes(textColor)
    } else {
      this.addAttributes("text-black")
    }

    // 2) Font size
    const fontSizePure = anyJsonNode?.style?.fontSize;
    // console.log("buildStyle[66] fontSizePure", anyJsonNode?.style)
    if (typeof fontSizePure === "number") {
      const sizeClass = pxToFontSize(fontSizePure)
      this.addAttributes(sizeClass ? `text-${sizeClass}` : `text-[${fontSizePure}px]`)
    }

    // 3) Font weight
    const fontWeightPure = anyJsonNode?.style?.fontWeight;
    if (typeof fontWeightPure === "number") {
      this.addAttributes(mapFontWeight(fontWeightPure))
    }

    // 4) Font family
    const fontFamilyPure = anyJsonNode?.style?.fontFamily;
    if (fontFamilyPure) {
      const family = fontFamilyPure?.replace(/\s+/g, "_") || "sans"
      this.addAttributes(`font-['${fontFamilyPure}']`)
    }

    // 5) Letter spacing
    const letterSpacingPure = anyJsonNode?.style?.letterSpacing;
    // const fontSizePure = anyJsonNode?.style?.fontSize
    if (letterSpacingPure && fontSizePure) {
      const letterSpacing = letterSpacingPure as LetterSpacing
      const fontSize = fontSizePure as number
      const pxVal = letterSpacing.unit === "PIXELS"
        ? letterSpacing.value
        : (letterSpacing.value * fontSize) / 100
      if (pxVal) {
        const spacingClass = pxToLetterSpacing(pxVal)
        this.addAttributes(spacingClass ? `tracking-${spacingClass}` : `tracking-[${pxVal}px]`)
      }
    }

    // 6) Line height
    const lineHeightPure = anyJsonNode?.style?.lineHeightPx;
    // const fontSizePure = anyJsonNode?.style?.fontSize
    if (lineHeightPure && fontSizePure) {
      const lineHeight = lineHeightPure as LineHeight
      const fontSize = fontSizePure as number
      let pxVal = 0
      if (lineHeight.unit === "PIXELS") {
        pxVal = lineHeight.value
      } else if (lineHeight.unit === "PERCENT") {
        pxVal = (lineHeight.value * fontSize) / 100
      }
      if (pxVal > 0) {
        const lhClass = pxToLineHeight(pxVal)
        this.addAttributes(lhClass ? `leading-${lhClass}` : `leading-[${pxVal}px]`)
      }
    }

    // 7) Text alignment (horizontal) – can also be done in a separate method
    const textAlign = anyJsonNode?.style?.textAlignHorizontal;
    if (textAlign && textAlign !== "LEFT") {
      if (textAlign === "CENTER") {
        this.addAttributes("text-center")
      } else if (textAlign === "RIGHT") {
        this.addAttributes("text-right")
      } else if (textAlign === "JUSTIFIED") {
        this.addAttributes("text-justify")
      }
    }
  }

    /**
   * https://tailwindcss.com/docs/text-align/
   * example: text-justify
   */
    textAlignHorizontal(): this {
        // if alignHorizontal is LEFT, don't do anything because that is native
        const anyJsonNode = this.node as any;
        // const node = this.node as TextNode;
        const textAlign = anyJsonNode?.style?.textAlignHorizontal;
        // only undefined in testing
        if (textAlign && textAlign !== "LEFT") {
          // todo when node.textAutoResize === "WIDTH_AND_HEIGHT" and there is no \n in the text, this can be ignored.
          switch (textAlign) {
            case "CENTER":
              this.addAttributes(`text-center`);
              break;
            case "RIGHT":
              this.addAttributes(`text-right`);
              break;
            case "JUSTIFIED":
              this.addAttributes(`text-justify`);
              break;
            default:
              break;
          }
        }
    
        return this;
      }

  /**
   * https://tailwindcss.com/docs/vertical-align/
   * example: align-top, align-middle, align-bottom
   */
  textAlignVertical(): this {
    const anyJsonNode = this.node as any;
        // const node = this.node as TextNode;
    const textAlign = anyJsonNode?.style?.textAlignVertical;
    switch (textAlign) {
      case "TOP":
        this.addAttributes("justify-start");
        break;
      case "CENTER":
        this.addAttributes("justify-center");
        break;
      case "BOTTOM":
        this.addAttributes("justify-end");
        break;
      default:
        break;
    }

    return this;
  }

  /**
   * Optional override of commonPositionStyles if you want to do something different for text.
   * For example, we can just call super’s method:
   */
  public commonPositionStyles(): this {
    super.commonPositionStyles()
    return this
  }

  /**
   * If you need text segments for multi-style text, produce them here. For single-style text,
   * just return one segment with the same classes we’ve placed in `this.attributes`.
   */
  public getTextSegments(node: TextNode): TextSegment[] {
    // Simple approach: single text style from the base classes
    // const anyJsonNode = this.node as any;
    return [
      {
        style: this.attributes.join(" "),
        text: node.characters || node.name,
        openTypeFeatures: {}
      }
    ]
  }
}
