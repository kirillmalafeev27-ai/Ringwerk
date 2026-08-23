type RuntimeEnvironment = Record<string, unknown>;

const ENVIRONMENT_SLOT = Symbol.for("ringwerk.runtime-environment");

type EnvironmentGlobal = typeof globalThis & {
  [ENVIRONMENT_SLOT]?: RuntimeEnvironment;
};

export function setRuntimeEnvironment(environment: RuntimeEnvironment) {
  (globalThis as EnvironmentGlobal)[ENVIRONMENT_SLOT] = environment;
}

export function getRuntimeEnvironment(): Record<string, string | undefined> {
  const bindingEnvironment = (globalThis as EnvironmentGlobal)[ENVIRONMENT_SLOT] ?? {};
  const processEnvironment = typeof process !== "undefined" ? process.env : {};
  return new Proxy(processEnvironment, {
    get(target, property: string | symbol) {
      if (typeof property !== "string") return Reflect.get(target, property);
      const bound = bindingEnvironment[property];
      if (typeof bound === "string") return bound;
      return target[property];
    },
  });
}
