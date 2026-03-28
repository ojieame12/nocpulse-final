export type MapRuntimeContract<TRenderModel> = {
  mount(container: HTMLElement, model: TRenderModel): Promise<void>;
  update(model: TRenderModel): Promise<void>;
  unmount(): Promise<void>;
};
