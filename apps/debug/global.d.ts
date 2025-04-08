// global.d.ts
export {};

declare global {
  var figma: {
    mixed: any;
    ui: {
      postMessage: (message: any, options?: WindowPostMessageOptions) => void;
    };
    clientStorage: {
      getAsync: (key: string) => Promise<any>;
      setAsync: (key: string, value: any) => Promise<void>;
    };
    getNodeByIdAsync: (id: string) => Promise<any>;
    // Add additional properties as needed.
  };
}
