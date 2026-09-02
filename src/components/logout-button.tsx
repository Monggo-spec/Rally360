import { logoutAction } from "@/lib/actions/auth";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="button quiet small">
        Sign out
      </button>
    </form>
  );
}
