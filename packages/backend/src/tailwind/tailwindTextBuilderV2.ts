// TailwindTextBuilderV2.ts
import { TailwindSettings } from "types";
import { tailwindColorFromFills } from "../tailwind/builderImpl/tailwindColor";
import {
  pxToFontSize,
  pxToLetterSpacing,
  pxToLineHeight,
} from "../tailwind/conversionTables";
import { TailwindDefaultBuilder } from "./tailwindDefaultBuilder";

// Helper to map numeric font weight to Tailwind classes.
const mapFontWeight = (weight: number): string => {
  if (weight <= 100) return "font-thin";
  if (weight <= 200) return "font-extralight";
  if (weight <= 300) return "font-light";
  if (weight <= 400) return "font-normal";
  if (weight <= 500) return "font-medium";
  if (weight <= 600) return "font-semibold";
  if (weight <= 700) return "font-bold";
  if (weight <= 800) return "font-extrabold";
  return "font-black";
};

export interface TextSegment {
  style: string;
  text: string;
  openTypeFeatures: Record<string, boolean>;
}

export class TailwindTextBuilderV2 extends TailwindDefaultBuilder {
  private node: any;
  private settings: TailwindSettings;
  private styleClasses: string[];
  private textContent: string;

  constructor(node: any, settings: TailwindSettings) {
    this.node = node;
    this.settings = settings;
    this.styleClasses = [];
    // Use the 'characters' property as the fallback text content.
    this.textContent = node.characters || "";
    this.buildStyle();
  }

  // Build the base styles from properties.
  private buildStyle() {
    // Use the fills array to generate a text color class (fallback to text-black).
    const textColor = tailwindColorFromFills(this.node.fills, "text");
    this.styleClasses.push(textColor ? textColor : "text-black");

    // Font size from node.style.fontSize (assumed in px).
    const fontSize = this.node.style?.fontSize;
    if (fontSize !== undefined) {
      const sizeClass = pxToFontSize(fontSize);
      this.styleClasses.push(
        sizeClass ? `text-${sizeClass}` : `text-[${fontSize}px]`
      );
    }

    // Font weight from node.style.fontWeight.
    const fontWeight = this.node.style?.fontWeight;
    if (fontWeight !== undefined) {
      this.styleClasses.push(mapFontWeight(fontWeight));
    }

    // Font family: using arbitrary syntax if present.
    const fontFamily = this.node.style?.fontFamily;
    if (fontFamily) {
      // Use single quotes; this assumes the font name does not contain a single quote.
      this.styleClasses.push(`font-['${fontFamily}']`);
    }

    // Letter spacing from node.style.letterSpacing.
    const letterSpacing = this.node.style?.letterSpacing;
    if (letterSpacing !== undefined && letterSpacing !== 0) {
      const spacing = pxToLetterSpacing(letterSpacing);
      this.styleClasses.push(
        spacing ? `tracking-${spacing}` : `tracking-[${letterSpacing}px]`
      );
    }

    // Line height from node.style.lineHeightPx.
    const lineHeight = this.node.style?.lineHeightPx;
    if (lineHeight !== undefined && lineHeight !== 0) {
      const lh = pxToLineHeight(lineHeight);
      this.styleClasses.push(
        lh ? `leading-${lh}` : `leading-[${lineHeight}px]`
      );
    }

    // Horizontal text alignment.
    const align = this.node.style?.textAlignHorizontal;
    if (align) {
      if (align === "CENTER") {
        this.styleClasses.push("text-center");
      } else if (align === "RIGHT") {
        this.styleClasses.push("text-right");
      }
      // LEFT is default, no additional class needed.
    }
  }

//   // Chainable method to add additional attributes (class names)
//   public addAttributes(...classes: string[]): this {
//     this.styleClasses.push(...classes.filter((cls) => cls && cls.trim() !== ""));
//     return this;
//   }

  // Chainable method: adds classes for absolute positioning if available.
  public commonPositionStyles(): this {
    if (this.node.absoluteBoundingBox) {
      const { x, y } = this.node.absoluteBoundingBox;
      // Using arbitrary utility classes for left, top and absolute positioning.
      this.addAttributes(`left-[${x}px]`, `top-[${y}px]`, "absolute");
    }
    return this;
  }

  // Chainable method for horizontal alignment.
  public textAlignHorizontal(): this {
    const align = this.node.style?.textAlignHorizontal;
    if (align) {
      if (align === "CENTER") {
        this.addAttributes("text-center");
      } else if (align === "RIGHT") {
        this.addAttributes("text-right");
      }
    }
    return this;
  }

  // Chainable method for vertical alignment (using approximate classes).
  public textAlignVertical(): this {
    const align = this.node.style?.textAlignVertical;
    if (align) {
      // Tailwind doesn't directly support vertical align for block text,
      // but if you're wrapping text in a flex container, you might control it.
      if (align === "CENTER") {
        this.addAttributes("align-middle");
      } else if (align === "BOTTOM") {
        this.addAttributes("align-bottom");
      }
    }
    return this;
  }

  // Return the text segments
  // Since we have no styled segments, just return a single segment with aggregated styles.
  public getTextSegments(node: TextNode): TextSegment[] {
    // console.log("tailwindText[149] ", node);
    return [
      {
        style: this.styleClasses.join(" "),
        text: node.name || node.characters,
        openTypeFeatures: {},
      },
    ];
  }

//   // Final build method returns the complete HTML string.
//   public build(): string {
//     // const classes = this.styleClasses.join(" ");
//     // return `<div class="${classes}">${this.textContent}</div>`;
//     return `${this.textContent}`;
//   }
}
