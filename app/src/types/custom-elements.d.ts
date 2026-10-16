import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "shortmail-widget": {
        vanity?: string;
        hidden?: boolean;
        children?: React.ReactNode;
      };
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "shortmail-widget": {
        vanity?: string;
        hidden?: boolean;
        children?: React.ReactNode;
      };
    }
  }
}

export {};
