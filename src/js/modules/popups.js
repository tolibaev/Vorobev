export function PopupFunction() {

   const popupLinks = document.querySelectorAll('._popup-link');
   const body = document.querySelector('body');
   const lockPadding = document.querySelectorAll('._lock-padding');
   const popupItems = document.querySelectorAll('.popup');
   const popupItemsArray = Array.from(popupItems);

   const wrapper = document.querySelector('.wrapper');
   const wrapperArray = Array.from(wrapper.children);

   let unlock = true;

   const timeout = 800;

   if (popupLinks.length > 0) {
      for (let index = 0; index < popupLinks.length; index++) {
         const popupLink = popupLinks[index];
         popupLink.addEventListener("click", function (e) {
            const popupName = popupLink.getAttribute('href').replace('#', '');
            const curentPopup = document.getElementById(popupName);
            popupOpen(curentPopup);
            e.preventDefault();
         });
      }

   }

   const popupCloseIcon = document.querySelectorAll('._close-popup');
   if (popupCloseIcon.length > 0) {
      for (let index = 0; index < popupCloseIcon.length; index++) {
         const el = popupCloseIcon[index];
         el.addEventListener("click", function (e) {
            popupClose(el.closest('.popup'));
         });
      }
   }

   function popupOpen(curentPopup) {
      if (curentPopup && unlock) {
         const popupActive = document.querySelector('.popup._open');
         if (popupActive) {
            popupClose(popupActive, false);
         } else {
            bodyLock();
         }
         curentPopup.classList.add('_open');


         wrapperArray.forEach((wrapperItem) => {
            const isPopupItem = popupItemsArray.some((popupItem) => popupItem === wrapperItem);
            if (!isPopupItem) {
               wrapperItem.inert = true;
               wrapperItem.setAttribute('tabindex', '-1');
               wrapperItem.setAttribute('aria-hidden', 'true');
            }
         });

         curentPopup.addEventListener("click", function (e) {
            if (!e.target.closest('.popup__content')) {
               popupClose(e.target.closest('.popup'));
            }
         });
      }
   }
   function popupClose(popupActive, doUnlock = true) {
      if (unlock) {
         popupActive.classList.remove('_open');

         wrapperArray.forEach((wrapperItem) => {
            const isPopupItem = popupItemsArray.some((popupItem) => popupItem === wrapperItem);
            if (!isPopupItem) {
               wrapperItem.inert = false;
               wrapperItem.setAttribute('tabindex', '0');
               wrapperItem.setAttribute('aria-hidden', 'false');
            }
         });

         if (doUnlock) {
            bodyUnlock();

            wrapperArray.forEach((wrapperItem) => {
               const isPopupItem = popupItemsArray.some((popupItem) => popupItem === wrapperItem);
               if (!isPopupItem) {
                  wrapperItem.inert = false;
                  wrapperItem.setAttribute('tabindex', '0');
                  wrapperItem.setAttribute('aria-hidden', 'false');
               }
            });

         }
      }
   }

   function bodyLock() {
      const lockPaddingValue = window.innerWidth - body.offsetWidth + 'px';
      if (lockPadding.length > 0) {
         for (let index = 0; index < lockPadding.length; index++) {
            const el = lockPadding[index];
            el.style.paddingRight = lockPaddingValue;
         }
      }
      body.style.paddingRight = lockPaddingValue;
      body.classList.add('_lock');
      unlock = false;
      setTimeout(function () {
         unlock = true
      }, timeout);
   }

   function bodyUnlock() {
      setTimeout(function () {
         if (lockPadding.length > 0) {
            for (let index = 0; index < lockPadding.length; index++) {
               const el = lockPadding[index];
               el.style.paddingRight = '0px';
            }
         }
         body.style.paddingRight = '0px';
         body.classList.remove('_lock');
      }, timeout);
   }

   document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
         const popupActive = document.querySelector('.popup._open');
         popupClose(popupActive);
      }
   });
}