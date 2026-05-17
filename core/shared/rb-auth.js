/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-auth.js

   AUTH SYSTEM
   Synced To rb-supabase.js
========================= */

import {
  getSupabase,
  getSession,
  getUser,
  getProfile,
  bootAuth,
  loadProfile,
  signUp as rbSignUp,
  signIn as rbSignIn,
  signOut as rbSignOut,
  isAuthed
} from "/core/shared/rb-supabase.js";

import {
  RB_ROUTES
} from "/core/shared/rb-config.js";

const supabase = getSupabase();

/* =========================
   BOOT
========================= */

await bootAuth();

/* =========================
   AUTH HELPERS
========================= */

export function getAuthState() {
  return {
    session: getSession(),
    user: getUser(),
    profile: getProfile(),
    authed: isAuthed()
  };
}

export function requireAuth({
  redirectTo = RB_ROUTES.auth
} = {}) {
  const user = getUser();

  if (!user) {
    window.location.href = redirectTo;
    return false;
  }

  return true;
}

export function requireGuest({
  redirectTo = RB_ROUTES.feed
} = {}) {
  const user = getUser();

  if (user) {
    window.location.href = redirectTo;
    return false;
  }

  return true;
}

/* =========================
   SIGN UP
========================= */

export async function signUp({
  email,
  password,
  username = "",
  displayName = ""
}) {
  try {
    const data = await rbSignUp({
      email,
      password,

      metadata: {
        username,
        display_name: displayName
      }
    });

    return {
      ok: true,
      data
    };
  } catch (error) {
    console.error(
      "[RB SIGNUP ERROR]",
      error
    );

    return {
      ok: false,
      error
    };
  }
}

/* =========================
   SIGN IN
========================= */

export async function signIn({
  email,
  password
}) {
  try {
    const data = await rbSignIn({
      email,
      password
    });

    return {
      ok: true,
      data
    };
  } catch (error) {
    console.error(
      "[RB SIGNIN ERROR]",
      error
    );

    return {
      ok: false,
      error
    };
  }
}

/* =========================
   SIGN OUT
========================= */

export async function logout({
  redirectTo = RB_ROUTES.home
} = {}) {
  try {
    await rbSignOut();

    window.location.href =
      redirectTo;

    return {
      ok: true
    };
  } catch (error) {
    console.error(
      "[RB LOGOUT ERROR]",
      error
    );

    return {
      ok: false,
      error
    };
  }
}

/* =========================
   PASSWORD RESET
========================= */

export async function sendPasswordReset(
  email
) {
  try {
    const {
      data,
      error
    } =
      await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo:
            `${window.location.origin}${RB_ROUTES.settings}`
        }
      );

    if (error) {
      throw error;
    }

    return {
      ok: true,
      data
    };
  } catch (error) {
    console.error(
      "[RB PASSWORD RESET ERROR]",
      error
    );

    return {
      ok: false,
      error
    };
  }
}

/* =========================
   UPDATE PASSWORD
========================= */

export async function updatePassword(
  password
) {
  try {
    const {
      data,
      error
    } =
      await supabase.auth.updateUser({
        password
      });

    if (error) {
      throw error;
    }

    return {
      ok: true,
      data
    };
  } catch (error) {
    console.error(
      "[RB UPDATE PASSWORD ERROR]",
      error
    );

    return {
      ok: false,
      error
    };
  }
}

/* =========================
   OAUTH
========================= */

export async function signInWithProvider(
  provider = "google"
) {
  try {
    const {
      data,
      error
    } =
      await supabase.auth.signInWithOAuth(
        {
          provider,

          options: {
            redirectTo:
              window.location.origin
          }
        }
      );

    if (error) {
      throw error;
    }

    return {
      ok: true,
      data
    };
  } catch (error) {
    console.error(
      "[RB OAUTH ERROR]",
      error
    );

    return {
      ok: false,
      error
    };
  }
}

/* =========================
   SESSION REFRESH
========================= */

export async function refreshProfile() {
  const user = getUser();

  if (!user?.id) {
    return null;
  }

  return await loadProfile(
    user.id
  );
}

/* =========================
   AUTH EVENT BRIDGE
========================= */

window.addEventListener(
  "focus",
  async () => {
    if (getUser()?.id) {
      await refreshProfile();
    }
  }
);

/* =========================
   READY
========================= */

document.body.classList.add(
  "rb-auth-loaded"
);

console.log(
  "RB AUTH READY"
);
