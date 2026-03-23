declare module "onvif" {
  // Tipado mínimo para poder compilar; se puede refinar más adelante.
  export namespace Discovery {
    function probe(
      callback: (err: unknown, cams: any[]) => void
    ): void;
  }
}

