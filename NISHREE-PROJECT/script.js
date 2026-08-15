/* =========================================================
   NISHREE ATTIRE — LAUNCHING SOON
   Main JavaScript
   ========================================================= */


/* =========================================================
   CONFIGURATION
   ========================================================= */

const CONFIG = {
  launchDate: "2026-11-01T10:00:00+05:30",
  mobileBreakpoint: 680,
  formResetDelay: 4000,
  cursorEase: 0.12
};


/* =========================================================
   1. LAUNCH COUNTDOWN
   01 November 2026 — 10:00 AM IST
   ========================================================= */

const LAUNCH_DATE =
  new Date(CONFIG.launchDate).getTime();


const daysEl =
  document.getElementById("days");

const hoursEl =
  document.getElementById("hours");

const minutesEl =
  document.getElementById("minutes");

const secondsEl =
  document.getElementById("seconds");

const messageEl =
  document.getElementById("countdown-message");


function pad(value) {
  return String(
    Math.max(0, value)
  ).padStart(2, "0");
}


/* Prevent unnecessary animation every second */

const previousCountdown = {
  days: null,
  hours: null,
  minutes: null,
  seconds: null
};


function animateCountdownValue(element) {

  if (!element) {
    return;
  }

  /* Respect reduced-motion preference */

  if (
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
  ) {
    return;
  }

  element.animate(
    [
      {
        transform: "translateY(-4px)",
        opacity: 0.55
      },
      {
        transform: "translateY(0)",
        opacity: 1
      }
    ],
    {
      duration: 280,
      easing: "cubic-bezier(.2,.65,.2,1)"
    }
  );
}


function updateCountdown() {

  if (
    !daysEl ||
    !hoursEl ||
    !minutesEl ||
    !secondsEl
  ) {
    return;
  }


  const distance =
    LAUNCH_DATE - Date.now();


  /* =========================================
     LAUNCH REACHED
     ========================================= */

  if (distance <= 0) {

    daysEl.textContent = "00";
    hoursEl.textContent = "00";
    minutesEl.textContent = "00";
    secondsEl.textContent = "00";

    if (messageEl) {
      messageEl.textContent =
        "We’re live. Welcome to NISHREE ATTIRE.";
    }

    document.title =
      "NISHREE ATTIRE — We’re Live";

    return;
  }


  /* =========================================
     CALCULATE TIME
     ========================================= */

  const totalSeconds =
    Math.floor(distance / 1000);


  const days =
    Math.floor(
      totalSeconds / 86400
    );


  const hours =
    Math.floor(
      (totalSeconds % 86400) / 3600
    );


  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );


  const seconds =
    totalSeconds % 60;


  const values = {
    days: pad(days),
    hours: pad(hours),
    minutes: pad(minutes),
    seconds: pad(seconds)
  };


  /* =========================================
     UPDATE ONLY WHEN VALUE CHANGES
     ========================================= */

  if (
    previousCountdown.days !== values.days
  ) {

    daysEl.textContent =
      values.days;

    animateCountdownValue(daysEl);

    previousCountdown.days =
      values.days;
  }


  if (
    previousCountdown.hours !== values.hours
  ) {

    hoursEl.textContent =
      values.hours;

    animateCountdownValue(hoursEl);

    previousCountdown.hours =
      values.hours;
  }


  if (
    previousCountdown.minutes !== values.minutes
  ) {

    minutesEl.textContent =
      values.minutes;

    animateCountdownValue(minutesEl);

    previousCountdown.minutes =
      values.minutes;
  }


  if (
    previousCountdown.seconds !== values.seconds
  ) {

    secondsEl.textContent =
      values.seconds;

    animateCountdownValue(secondsEl);

    previousCountdown.seconds =
      values.seconds;
  }
}


/* Initial */

updateCountdown();


/* Update every second */

const countdownInterval =
  window.setInterval(
    () => {

      updateCountdown();

      if (
        Date.now() >=
        LAUNCH_DATE
      ) {
        clearInterval(
          countdownInterval
        );
      }

    },
    1000
  );



/* =========================================================
   2. SCROLL REVEAL
   ========================================================= */

const revealElements =
  document.querySelectorAll(
    ".reveal"
  );


function enableRevealAnimation() {

  if (
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
  ) {

    revealElements.forEach(
      (element) => {

        element.classList.add(
          "is-visible"
        );

      }
    );

    return;
  }


  if (
    !("IntersectionObserver" in window)
  ) {

    revealElements.forEach(
      (element) => {

        element.classList.add(
          "is-visible"
        );

      }
    );

    return;
  }


  const observer =
    new IntersectionObserver(
      (entries, observerInstance) => {

        entries.forEach(
          (entry) => {

            if (
              !entry.isIntersecting
            ) {
              return;
            }


            entry.target.classList.add(
              "is-visible"
            );


            observerInstance.unobserve(
              entry.target
            );

          }
        );

      },
      {
        threshold: 0.12,

        rootMargin:
          "0px 0px -50px 0px"
      }
    );


  revealElements.forEach(
    (element) => {

      observer.observe(
        element
      );

    }
  );
}


enableRevealAnimation();



/* =========================================================
   3. CURSOR GLOW
   Desktop / Mouse devices only
   ========================================================= */

const cursorGlow =
  document.querySelector(
    ".cursor-glow"
  );


const canUseHover =
  window.matchMedia(
    "(hover: hover) and (pointer: fine)"
  );


if (
  cursorGlow &&
  canUseHover.matches
) {

  let targetX =
    window.innerWidth / 2;

  let targetY =
    window.innerHeight / 2;

  let currentX =
    targetX;

  let currentY =
    targetY;


  window.addEventListener(
    "pointermove",
    (event) => {

      targetX =
        event.clientX;

      targetY =
        event.clientY;

    },
    {
      passive: true
    }
  );


  function updateCursorGlow() {

    currentX +=
      (targetX - currentX) *
      CONFIG.cursorEase;

    currentY +=
      (targetY - currentY) *
      CONFIG.cursorEase;


    cursorGlow.style.left =
      `${currentX}px`;

    cursorGlow.style.top =
      `${currentY}px`;


    requestAnimationFrame(
      updateCursorGlow
    );
  }


  updateCursorGlow();


  /* Hide glow while cursor leaves viewport */

  document.addEventListener(
    "mouseleave",
    () => {

      cursorGlow.style.opacity =
        "0";

    }
  );


  document.addEventListener(
    "mouseenter",
    () => {

      cursorGlow.style.opacity =
        "";

    }
  );
}



/* =========================================================
   4. FULL SCREEN MENU
   ========================================================= */

const menuButton =
  document.querySelector(
    ".menu-button"
  );

const closeMenuButton =
  document.querySelector(
    ".close-menu"
  );

const menuPanel =
  document.querySelector(
    ".menu-panel"
  );


const menuLinks =
  menuPanel
    ? menuPanel.querySelectorAll(
        "a"
      )
    : [];


let previousFocusedElement =
  null;


function setMenu(open) {

  if (
    !menuPanel ||
    !menuButton
  ) {
    return;
  }


  if (open) {

    previousFocusedElement =
      document.activeElement;
  }


  menuPanel.classList.toggle(
    "open",
    open
  );


  menuPanel.setAttribute(
    "aria-hidden",
    String(!open)
  );


  menuButton.setAttribute(
    "aria-expanded",
    String(open)
  );


  document.body.classList.toggle(
    "menu-open",
    open
  );


  if (open) {

    requestAnimationFrame(
      () => {

        if (closeMenuButton) {
          closeMenuButton.focus();
        }

      }
    );

  } else {

    if (
      previousFocusedElement &&
      typeof previousFocusedElement.focus ===
        "function"
    ) {

      previousFocusedElement.focus();

    }

  }
}


/* Open menu */

if (menuButton) {

  menuButton.addEventListener(
    "click",
    () => {

      setMenu(true);

    }
  );

}


/* Close menu */

if (closeMenuButton) {

  closeMenuButton.addEventListener(
    "click",
    () => {

      setMenu(false);

    }
  );

}


/* Menu navigation */

menuLinks.forEach(
  (link) => {

    link.addEventListener(
      "click",
      () => {

        setMenu(false);

      }
    );

  }
);


/* Escape */

window.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key === "Escape" &&
      menuPanel?.classList.contains(
        "open"
      )
    ) {

      setMenu(false);

    }

  }
);


/* Click backdrop to close */

if (menuPanel) {

  menuPanel.addEventListener(
    "click",
    (event) => {

      if (
        event.target ===
        menuPanel
      ) {

        setMenu(false);

      }

    }
  );

}



/* =========================================================
   5. EARLY ACCESS FORM
   Fields:
   Name
   Mobile
   Email
   Formspree
   ========================================================= */

const notifyForm =
  document.getElementById(
    "notify-form"
  );

const formMessage =
  document.getElementById(
    "form-message"
  );


if (notifyForm) {

  const submitButton =
    notifyForm.querySelector(
      ".notify-button"
    );


  const buttonText =
    submitButton?.querySelector(
      "span:first-child"
    );


  let isSubmitting =
    false;


  notifyForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      /* Prevent duplicate submissions */

      if (isSubmitting) {
        return;
      }


      clearFormMessage();


      const nameInput =
        document.getElementById(
          "name"
        );

      const phoneInput =
        document.getElementById(
          "phone"
        );

      const emailInput =
        document.getElementById(
          "email"
        );


      const name =
        nameInput?.value.trim() ||
        "";


      const phone =
        phoneInput?.value.trim() ||
        "";


      const email =
        emailInput?.value.trim() ||
        "";


      /* =====================================
         NAME
         ===================================== */

      if (
        name.length < 2
      ) {

        showFormError(
          "Please enter your name."
        );

        nameInput?.focus();

        return;
      }


      /* =====================================
         PHONE
         ===================================== */

      const phonePattern =
        /^[0-9+\-\s()]{8,20}$/;


      if (
        !phonePattern.test(
          phone
        )
      ) {

        showFormError(
          "Please enter a valid mobile number."
        );

        phoneInput?.focus();

        return;
      }


      /* =====================================
         EMAIL
         ===================================== */

      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


      if (
        !emailPattern.test(
          email
        )
      ) {

        showFormError(
          "Please enter a valid email address."
        );

        emailInput?.focus();

        return;
      }


      /* =====================================
         SUBMITTING
         ===================================== */

      isSubmitting =
        true;


      if (submitButton) {
        submitButton.disabled =
          true;
      }


      if (buttonText) {
        buttonText.textContent =
          "JOINING...";
      }


      try {

        const response =
          await fetch(
            notifyForm.action,
            {
              method: "POST",

              body:
                new FormData(
                  notifyForm
                ),

              headers: {
                Accept:
                  "application/json"
              }
            }
          );


        if (
          response.ok
        ) {

          /* Success message */

          showFormSuccess(
            "You're on the list. See you at launch ✦"
          );


          /* Reset */

          notifyForm.reset();


          /* Success button */

          if (buttonText) {

            buttonText.textContent =
              "YOU'RE IN ✓";

          }


          /* Restore */

          window.setTimeout(
            () => {

              if (buttonText) {

                buttonText.textContent =
                  "JOIN THE LIST";

              }


              if (submitButton) {

                submitButton.disabled =
                  false;

              }


              isSubmitting =
                false;

            },
            CONFIG.formResetDelay
          );


        } else {

          throw new Error(
            "Formspree submission failed."
          );

        }

      } catch (error) {

        console.error(
          "NISHREE ATTIRE form error:",
          error
        );


        showFormError(
          "Something went wrong. Please try again."
        );


        if (buttonText) {

          buttonText.textContent =
            "TRY AGAIN";

        }


        if (submitButton) {

          submitButton.disabled =
            false;

        }


        isSubmitting =
          false;

      }

    }
  );
}



/* =========================================================
   6. FORM MESSAGE HELPERS
   ========================================================= */

function clearFormMessage() {

  if (!formMessage) {
    return;
  }


  formMessage.textContent =
    "";


  formMessage.classList.remove(
    "success",
    "error"
  );
}


function showFormError(message) {

  if (!formMessage) {
    return;
  }


  formMessage.textContent =
    message;


  formMessage.classList.remove(
    "success"
  );


  formMessage.classList.add(
    "error"
  );
}


function showFormSuccess(message) {

  if (!formMessage) {
    return;
  }


  formMessage.textContent =
    message;


  formMessage.classList.remove(
    "error"
  );


  formMessage.classList.add(
    "success"
  );
}



/* =========================================================
   7. PHONE INPUT CLEANUP
   ========================================================= */

const phoneInput =
  document.getElementById(
    "phone"
  );


if (phoneInput) {

  phoneInput.addEventListener(
    "input",
    () => {

      phoneInput.value =
        phoneInput.value.replace(
          /[^0-9+\-\s()]/g,
          ""
        );

    }
  );


  /* Prevent extremely long input */

  phoneInput.setAttribute(
    "maxlength",
    "20"
  );
}



/* =========================================================
   8. FORM MICRO INTERACTIONS
   ========================================================= */

const formInputs =
  document.querySelectorAll(
    ".notify-form input"
  );


formInputs.forEach(
  (input) => {

    input.addEventListener(
      "focus",
      () => {

        input.parentElement?.classList.add(
          "is-focused"
        );

      }
    );


    input.addEventListener(
      "blur",
      () => {

        input.parentElement?.classList.remove(
          "is-focused"
        );

      }
    );


    /* Remove error state while typing */

    input.addEventListener(
      "input",
      () => {

        if (
          formMessage?.classList.contains(
            "error"
          )
        ) {

          clearFormMessage();

        }

      }
    );

  }
);



/* =========================================================
   9. IMAGE LOADING EFFECT
   ========================================================= */

const pageImages =
  document.querySelectorAll(
    "img"
  );


pageImages.forEach(
  (image) => {

    /* Already loaded */

    if (
      image.complete &&
      image.naturalWidth > 0
    ) {

      image.classList.add(
        "image-loaded"
      );

      return;
    }


    image.addEventListener(
      "load",
      () => {

        image.classList.add(
          "image-loaded"
        );

      },
      {
        once: true
      }
    );


    image.addEventListener(
      "error",
      () => {

        image.classList.add(
          "image-error"
        );

      },
      {
        once: true
      }
    );

  }
);



/* =========================================================
   10. PAGE READY
   ========================================================= */

window.addEventListener(
  "load",
  () => {

    document.body.classList.add(
      "page-loaded"
    );

  }
);