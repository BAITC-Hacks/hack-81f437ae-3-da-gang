import { createContext, useContext, useState, type ReactNode } from "react";

type Role = "business" | "team";
const RoleContext = createContext<{
  role: Role;
  setRole: (role: Role) => void;
}>({ role: "business", setRole: () => {} });

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, updateRole] = useState<Role>(() => {
    try {
      return localStorage.getItem("sana-role") === "team" ? "team" : "business";
    } catch {
      return "business";
    }
  });
  function setRole(value: Role) {
    updateRole(value);
    try {
      localStorage.setItem("sana-role", value);
    } catch {
      /* Role still works without storage. */
    }
  }
  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}
export function useRole() {
  return useContext(RoleContext);
}
export function RoleSwitch() {
  const { role, setRole } = useRole();
  return (
    <div className="role-switch" aria-label="Демонстрационная роль">
      <button
        aria-pressed={role === "business"}
        onClick={() => setRole("business")}
      >
        Я бизнес
      </button>
      <button aria-pressed={role === "team"} onClick={() => setRole("team")}>
        Я команда
      </button>
    </div>
  );
}
export function BusinessOnly({ children }: { children: ReactNode }) {
  const { role, setRole } = useRole();
  return role === "business" ? (
    children
  ) : (
    <section className="panel">
      <h1>Кабинет бизнеса</h1>
      <p>
        В режиме команды выбирайте задачи в каталоге и отправляйте предложения.
        Для управления задачами переключитесь в режим бизнеса.
      </p>
      <button onClick={() => setRole("business")}>
        Перейти в режим бизнеса
      </button>
    </section>
  );
}
