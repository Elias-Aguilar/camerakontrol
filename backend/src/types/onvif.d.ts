declare module "onvif" {
  // Tipado mínimo para poder compilar; se puede refinar más adelante.
  export namespace Discovery {
    function probe(
      options: { timeout?: number; device?: string; resolve?: boolean },
      callback: (err: unknown, cams: any[]) => void
    ): void;
    function probe(
      callback: (err: unknown, cams: any[]) => void
    ): void;
  }
}

