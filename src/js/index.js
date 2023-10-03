"use strict";

import * as functions from "./modules/functions.js";
functions.isWebp();
// functions.isMobile();
// functions.menuBurger();
// functions.custumSelectFunction();
// functions.validationFormFunction();
functions.animationFunction();

// import { inertFunction } from "./modules/functions.js";
// inertFunction();

import { useDynamicAdapt } from "./modules/functions.js";
useDynamicAdapt();

// import { phoneMaskFunction } from "./modules/functions.js";
// phoneMaskFunction();

// import { PopupFunction } from "./modules/functions.js";
// PopupFunction();

// import { spollersInit } from "./modules/functions.js";
// spollersInit();

//=============================================================================================================================================

import Swiper from 'swiper';
import { Autoplay, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/autoplay';
import 'swiper/css/navigation';
new Swiper('.swiper', {
	modules: [Autoplay, Navigation],
	navigation: {
		nextEl: '.result__arrow--next',
		prevEl: '.result__arrow--prev',
	},
	autoplay: {
		delay: 1500,
		disableOnInteraction: false,
	},
	loop: true,
	speed: 1000,
	slidesPerView: 1,
	spaceBetween: 10,
	autoHeight: true,
	breakpoints: {
		991.98: {
			slidesPerView: 3,
			spaceBetween: 33,
		},
		767.98: {
			slidesPerView: 2,
			spaceBetween: 20,
		},
	},
});
//=============================================================================================================================================





