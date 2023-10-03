export function isMobile() {
	const mobiles = /Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
	return mobiles.test(navigator.userAgent);
}
export function isWebp() {
	function testWebP(callback) {
		let webP = new Image();
		webP.onload = webP.onerror = function () {
			callback(webP.height == 2);
		};
		webP.src = "data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA";
	}
	testWebP(function (support) {
		let className = support === true ? 'webp' : 'no-webp';
		document.documentElement.classList.add(className);
	});
}
//=============================================================================================================================================
export function inertFunction() {
	/**
 * This work is licensed under the W3C Software and Document License
 * (http://www.w3.org/Consortium/Legal/2015/copyright-software-and-document).
 */

	(function () {
		// Return early if we're not running inside of the browser.
		if (typeof window === 'undefined' || typeof Element === 'undefined') {
			return;
		}

		// Convenience function for converting NodeLists.
		/** @type {typeof Array.prototype.slice} */
		const slice = Array.prototype.slice;

		/**
		 * IE has a non-standard name for "matches".
		 * @type {typeof Element.prototype.matches}
		 */
		const matches =
			Element.prototype.matches || Element.prototype.msMatchesSelector;

		/** @type {string} */
		const _focusableElementsString = ['a[href]',
			'area[href]',
			'input:not([disabled])',
			'select:not([disabled])',
			'textarea:not([disabled])',
			'button:not([disabled])',
			'details',
			'summary',
			'iframe',
			'object',
			'embed',
			'video',
			'[contenteditable]'].join(',');

		/**
		 * `InertRoot` manages a single inert subtree, i.e. a DOM subtree whose root element has an `inert`
		 * attribute.
		 *
		 * Its main functions are:
		 *
		 * - to create and maintain a set of managed `InertNode`s, including when mutations occur in the
		 *   subtree. The `makeSubtreeUnfocusable()` method handles collecting `InertNode`s via registering
		 *   each focusable node in the subtree with the singleton `InertManager` which manages all known
		 *   focusable nodes within inert subtrees. `InertManager` ensures that a single `InertNode`
		 *   instance exists for each focusable node which has at least one inert root as an ancestor.
		 *
		 * - to notify all managed `InertNode`s when this subtree stops being inert (i.e. when the `inert`
		 *   attribute is removed from the root node). This is handled in the destructor, which calls the
		 *   `deregister` method on `InertManager` for each managed inert node.
		 */
		class InertRoot {
			/**
			 * @param {!HTMLElement} rootElement The HTMLElement at the root of the inert subtree.
			 * @param {!InertManager} inertManager The global singleton InertManager object.
			 */
			constructor(rootElement, inertManager) {
				/** @type {!InertManager} */
				this._inertManager = inertManager;

				/** @type {!HTMLElement} */
				this._rootElement = rootElement;

				/**
				 * @type {!Set<!InertNode>}
				 * All managed focusable nodes in this InertRoot's subtree.
				 */
				this._managedNodes = new Set();

				// Make the subtree hidden from assistive technology
				if (this._rootElement.hasAttribute('aria-hidden')) {
					/** @type {?string} */
					this._savedAriaHidden = this._rootElement.getAttribute('aria-hidden');
				} else {
					this._savedAriaHidden = null;
				}
				this._rootElement.setAttribute('aria-hidden', 'true');

				// Make all focusable elements in the subtree unfocusable and add them to _managedNodes
				this._makeSubtreeUnfocusable(this._rootElement);

				// Watch for:
				// - any additions in the subtree: make them unfocusable too
				// - any removals from the subtree: remove them from this inert root's managed nodes
				// - attribute changes: if `tabindex` is added, or removed from an intrinsically focusable
				//   element, make that node a managed node.
				this._observer = new MutationObserver(this._onMutation.bind(this));
				this._observer.observe(this._rootElement, { attributes: true, childList: true, subtree: true });
			}

			/**
			 * Call this whenever this object is about to become obsolete.  This unwinds all of the state
			 * stored in this object and updates the state of all of the managed nodes.
			 */
			destructor() {
				this._observer.disconnect();

				if (this._rootElement) {
					if (this._savedAriaHidden !== null) {
						this._rootElement.setAttribute('aria-hidden', this._savedAriaHidden);
					} else {
						this._rootElement.removeAttribute('aria-hidden');
					}
				}

				this._managedNodes.forEach(function (inertNode) {
					this._unmanageNode(inertNode.node);
				}, this);

				// Note we cast the nulls to the ANY type here because:
				// 1) We want the class properties to be declared as non-null, or else we
				//    need even more casts throughout this code. All bets are off if an
				//    instance has been destroyed and a method is called.
				// 2) We don't want to cast "this", because we want type-aware optimizations
				//    to know which properties we're setting.
				this._observer = /** @type {?} */ (null);
				this._rootElement = /** @type {?} */ (null);
				this._managedNodes = /** @type {?} */ (null);
				this._inertManager = /** @type {?} */ (null);
			}

			/**
			 * @return {!Set<!InertNode>} A copy of this InertRoot's managed nodes set.
			 */
			get managedNodes() {
				return new Set(this._managedNodes);
			}

			/** @return {boolean} */
			get hasSavedAriaHidden() {
				return this._savedAriaHidden !== null;
			}

			/** @param {?string} ariaHidden */
			set savedAriaHidden(ariaHidden) {
				this._savedAriaHidden = ariaHidden;
			}

			/** @return {?string} */
			get savedAriaHidden() {
				return this._savedAriaHidden;
			}

			/**
			 * @param {!Node} startNode
			 */
			_makeSubtreeUnfocusable(startNode) {
				composedTreeWalk(startNode, (node) => this._visitNode(node));

				let activeElement = document.activeElement;

				if (!document.body.contains(startNode)) {
					// startNode may be in shadow DOM, so find its nearest shadowRoot to get the activeElement.
					let node = startNode;
					/** @type {!ShadowRoot|undefined} */
					let root = undefined;
					while (node) {
						if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
							root = /** @type {!ShadowRoot} */ (node);
							break;
						}
						node = node.parentNode;
					}
					if (root) {
						activeElement = root.activeElement;
					}
				}
				if (startNode.contains(activeElement)) {
					activeElement.blur();
					// In IE11, if an element is already focused, and then set to tabindex=-1
					// calling blur() will not actually move the focus.
					// To work around this we call focus() on the body instead.
					if (activeElement === document.activeElement) {
						document.body.focus();
					}
				}
			}

			/**
			 * @param {!Node} node
			 */
			_visitNode(node) {
				if (node.nodeType !== Node.ELEMENT_NODE) {
					return;
				}
				const element = /** @type {!HTMLElement} */ (node);

				// If a descendant inert root becomes un-inert, its descendants will still be inert because of
				// this inert root, so all of its managed nodes need to be adopted by this InertRoot.
				if (element !== this._rootElement && element.hasAttribute('inert')) {
					this._adoptInertRoot(element);
				}

				if (matches.call(element, _focusableElementsString) || element.hasAttribute('tabindex')) {
					this._manageNode(element);
				}
			}

			/**
			 * Register the given node with this InertRoot and with InertManager.
			 * @param {!Node} node
			 */
			_manageNode(node) {
				const inertNode = this._inertManager.register(node, this);
				this._managedNodes.add(inertNode);
			}

			/**
			 * Unregister the given node with this InertRoot and with InertManager.
			 * @param {!Node} node
			 */
			_unmanageNode(node) {
				const inertNode = this._inertManager.deregister(node, this);
				if (inertNode) {
					this._managedNodes.delete(inertNode);
				}
			}

			/**
			 * Unregister the entire subtree starting at `startNode`.
			 * @param {!Node} startNode
			 */
			_unmanageSubtree(startNode) {
				composedTreeWalk(startNode, (node) => this._unmanageNode(node));
			}

			/**
			 * If a descendant node is found with an `inert` attribute, adopt its managed nodes.
			 * @param {!HTMLElement} node
			 */
			_adoptInertRoot(node) {
				let inertSubroot = this._inertManager.getInertRoot(node);

				// During initialisation this inert root may not have been registered yet,
				// so register it now if need be.
				if (!inertSubroot) {
					this._inertManager.setInert(node, true);
					inertSubroot = this._inertManager.getInertRoot(node);
				}

				inertSubroot.managedNodes.forEach(function (savedInertNode) {
					this._manageNode(savedInertNode.node);
				}, this);
			}

			/**
			 * Callback used when mutation observer detects subtree additions, removals, or attribute changes.
			 * @param {!Array<!MutationRecord>} records
			 * @param {!MutationObserver} self
			 */
			_onMutation(records, self) {
				records.forEach(function (record) {
					const target = /** @type {!HTMLElement} */ (record.target);
					if (record.type === 'childList') {
						// Manage added nodes
						slice.call(record.addedNodes).forEach(function (node) {
							this._makeSubtreeUnfocusable(node);
						}, this);

						// Un-manage removed nodes
						slice.call(record.removedNodes).forEach(function (node) {
							this._unmanageSubtree(node);
						}, this);
					} else if (record.type === 'attributes') {
						if (record.attributeName === 'tabindex') {
							// Re-initialise inert node if tabindex changes
							this._manageNode(target);
						} else if (target !== this._rootElement &&
							record.attributeName === 'inert' &&
							target.hasAttribute('inert')) {
							// If a new inert root is added, adopt its managed nodes and make sure it knows about the
							// already managed nodes from this inert subroot.
							this._adoptInertRoot(target);
							const inertSubroot = this._inertManager.getInertRoot(target);
							this._managedNodes.forEach(function (managedNode) {
								if (target.contains(managedNode.node)) {
									inertSubroot._manageNode(managedNode.node);
								}
							});
						}
					}
				}, this);
			}
		}

		/**
		 * `InertNode` initialises and manages a single inert node.
		 * A node is inert if it is a descendant of one or more inert root elements.
		 *
		 * On construction, `InertNode` saves the existing `tabindex` value for the node, if any, and
		 * either removes the `tabindex` attribute or sets it to `-1`, depending on whether the element
		 * is intrinsically focusable or not.
		 *
		 * `InertNode` maintains a set of `InertRoot`s which are descendants of this `InertNode`. When an
		 * `InertRoot` is destroyed, and calls `InertManager.deregister()`, the `InertManager` notifies the
		 * `InertNode` via `removeInertRoot()`, which in turn destroys the `InertNode` if no `InertRoot`s
		 * remain in the set. On destruction, `InertNode` reinstates the stored `tabindex` if one exists,
		 * or removes the `tabindex` attribute if the element is intrinsically focusable.
		 */
		class InertNode {
			/**
			 * @param {!Node} node A focusable element to be made inert.
			 * @param {!InertRoot} inertRoot The inert root element associated with this inert node.
			 */
			constructor(node, inertRoot) {
				/** @type {!Node} */
				this._node = node;

				/** @type {boolean} */
				this._overrodeFocusMethod = false;

				/**
				 * @type {!Set<!InertRoot>} The set of descendant inert roots.
				 *    If and only if this set becomes empty, this node is no longer inert.
				 */
				this._inertRoots = new Set([inertRoot]);

				/** @type {?number} */
				this._savedTabIndex = null;

				/** @type {boolean} */
				this._destroyed = false;

				// Save any prior tabindex info and make this node untabbable
				this.ensureUntabbable();
			}

			/**
			 * Call this whenever this object is about to become obsolete.
			 * This makes the managed node focusable again and deletes all of the previously stored state.
			 */
			destructor() {
				this._throwIfDestroyed();

				if (this._node && this._node.nodeType === Node.ELEMENT_NODE) {
					const element = /** @type {!HTMLElement} */ (this._node);
					if (this._savedTabIndex !== null) {
						element.setAttribute('tabindex', this._savedTabIndex);
					} else {
						element.removeAttribute('tabindex');
					}

					// Use `delete` to restore native focus method.
					if (this._overrodeFocusMethod) {
						delete element.focus;
					}
				}

				// See note in InertRoot.destructor for why we cast these nulls to ANY.
				this._node = /** @type {?} */ (null);
				this._inertRoots = /** @type {?} */ (null);
				this._destroyed = true;
			}

			/**
			 * @type {boolean} Whether this object is obsolete because the managed node is no longer inert.
			 * If the object has been destroyed, any attempt to access it will cause an exception.
			 */
			get destroyed() {
				return /** @type {!InertNode} */ (this)._destroyed;
			}

			/**
			 * Throw if user tries to access destroyed InertNode.
			 */
			_throwIfDestroyed() {
				if (this.destroyed) {
					throw new Error('Trying to access destroyed InertNode');
				}
			}

			/** @return {boolean} */
			get hasSavedTabIndex() {
				return this._savedTabIndex !== null;
			}

			/** @return {!Node} */
			get node() {
				this._throwIfDestroyed();
				return this._node;
			}

			/** @param {?number} tabIndex */
			set savedTabIndex(tabIndex) {
				this._throwIfDestroyed();
				this._savedTabIndex = tabIndex;
			}

			/** @return {?number} */
			get savedTabIndex() {
				this._throwIfDestroyed();
				return this._savedTabIndex;
			}

			/** Save the existing tabindex value and make the node untabbable and unfocusable */
			ensureUntabbable() {
				if (this.node.nodeType !== Node.ELEMENT_NODE) {
					return;
				}
				const element = /** @type {!HTMLElement} */ (this.node);
				if (matches.call(element, _focusableElementsString)) {
					if (/** @type {!HTMLElement} */ (element).tabIndex === -1 &&
						this.hasSavedTabIndex) {
						return;
					}

					if (element.hasAttribute('tabindex')) {
						this._savedTabIndex = /** @type {!HTMLElement} */ (element).tabIndex;
					}
					element.setAttribute('tabindex', '-1');
					if (element.nodeType === Node.ELEMENT_NODE) {
						element.focus = function () { };
						this._overrodeFocusMethod = true;
					}
				} else if (element.hasAttribute('tabindex')) {
					this._savedTabIndex = /** @type {!HTMLElement} */ (element).tabIndex;
					element.removeAttribute('tabindex');
				}
			}

			/**
			 * Add another inert root to this inert node's set of managing inert roots.
			 * @param {!InertRoot} inertRoot
			 */
			addInertRoot(inertRoot) {
				this._throwIfDestroyed();
				this._inertRoots.add(inertRoot);
			}

			/**
			 * Remove the given inert root from this inert node's set of managing inert roots.
			 * If the set of managing inert roots becomes empty, this node is no longer inert,
			 * so the object should be destroyed.
			 * @param {!InertRoot} inertRoot
			 */
			removeInertRoot(inertRoot) {
				this._throwIfDestroyed();
				this._inertRoots.delete(inertRoot);
				if (this._inertRoots.size === 0) {
					this.destructor();
				}
			}
		}

		/**
		 * InertManager is a per-document singleton object which manages all inert roots and nodes.
		 *
		 * When an element becomes an inert root by having an `inert` attribute set and/or its `inert`
		 * property set to `true`, the `setInert` method creates an `InertRoot` object for the element.
		 * The `InertRoot` in turn registers itself as managing all of the element's focusable descendant
		 * nodes via the `register()` method. The `InertManager` ensures that a single `InertNode` instance
		 * is created for each such node, via the `_managedNodes` map.
		 */
		class InertManager {
			/**
			 * @param {!Document} document
			 */
			constructor(document) {
				if (!document) {
					throw new Error('Missing required argument; InertManager needs to wrap a document.');
				}

				/** @type {!Document} */
				this._document = document;

				/**
				 * All managed nodes known to this InertManager. In a map to allow looking up by Node.
				 * @type {!Map<!Node, !InertNode>}
				 */
				this._managedNodes = new Map();

				/**
				 * All inert roots known to this InertManager. In a map to allow looking up by Node.
				 * @type {!Map<!Node, !InertRoot>}
				 */
				this._inertRoots = new Map();

				/**
				 * Observer for mutations on `document.body`.
				 * @type {!MutationObserver}
				 */
				this._observer = new MutationObserver(this._watchForInert.bind(this));

				// Add inert style.
				addInertStyle(document.head || document.body || document.documentElement);

				// Wait for document to be loaded.
				if (document.readyState === 'loading') {
					document.addEventListener('DOMContentLoaded', this._onDocumentLoaded.bind(this));
				} else {
					this._onDocumentLoaded();
				}
			}

			/**
			 * Set whether the given element should be an inert root or not.
			 * @param {!HTMLElement} root
			 * @param {boolean} inert
			 */
			setInert(root, inert) {
				if (inert) {
					if (this._inertRoots.has(root)) { // element is already inert
						return;
					}

					const inertRoot = new InertRoot(root, this);
					root.setAttribute('inert', '');
					this._inertRoots.set(root, inertRoot);
					// If not contained in the document, it must be in a shadowRoot.
					// Ensure inert styles are added there.
					if (!this._document.body.contains(root)) {
						let parent = root.parentNode;
						while (parent) {
							if (parent.nodeType === 11) {
								addInertStyle(parent);
							}
							parent = parent.parentNode;
						}
					}
				} else {
					if (!this._inertRoots.has(root)) { // element is already non-inert
						return;
					}

					const inertRoot = this._inertRoots.get(root);
					inertRoot.destructor();
					this._inertRoots.delete(root);
					root.removeAttribute('inert');
				}
			}

			/**
			 * Get the InertRoot object corresponding to the given inert root element, if any.
			 * @param {!Node} element
			 * @return {!InertRoot|undefined}
			 */
			getInertRoot(element) {
				return this._inertRoots.get(element);
			}

			/**
			 * Register the given InertRoot as managing the given node.
			 * In the case where the node has a previously existing inert root, this inert root will
			 * be added to its set of inert roots.
			 * @param {!Node} node
			 * @param {!InertRoot} inertRoot
			 * @return {!InertNode} inertNode
			 */
			register(node, inertRoot) {
				let inertNode = this._managedNodes.get(node);
				if (inertNode !== undefined) { // node was already in an inert subtree
					inertNode.addInertRoot(inertRoot);
				} else {
					inertNode = new InertNode(node, inertRoot);
				}

				this._managedNodes.set(node, inertNode);

				return inertNode;
			}

			/**
			 * De-register the given InertRoot as managing the given inert node.
			 * Removes the inert root from the InertNode's set of managing inert roots, and remove the inert
			 * node from the InertManager's set of managed nodes if it is destroyed.
			 * If the node is not currently managed, this is essentially a no-op.
			 * @param {!Node} node
			 * @param {!InertRoot} inertRoot
			 * @return {?InertNode} The potentially destroyed InertNode associated with this node, if any.
			 */
			deregister(node, inertRoot) {
				const inertNode = this._managedNodes.get(node);
				if (!inertNode) {
					return null;
				}

				inertNode.removeInertRoot(inertRoot);
				if (inertNode.destroyed) {
					this._managedNodes.delete(node);
				}

				return inertNode;
			}

			/**
			 * Callback used when document has finished loading.
			 */
			_onDocumentLoaded() {
				// Find all inert roots in document and make them actually inert.
				const inertElements = slice.call(this._document.querySelectorAll('[inert]'));
				inertElements.forEach(function (inertElement) {
					this.setInert(inertElement, true);
				}, this);

				// Comment this out to use programmatic API only.
				this._observer.observe(this._document.body || this._document.documentElement, { attributes: true, subtree: true, childList: true });
			}

			/**
			 * Callback used when mutation observer detects attribute changes.
			 * @param {!Array<!MutationRecord>} records
			 * @param {!MutationObserver} self
			 */
			_watchForInert(records, self) {
				const _this = this;
				records.forEach(function (record) {
					switch (record.type) {
						case 'childList':
							slice.call(record.addedNodes).forEach(function (node) {
								if (node.nodeType !== Node.ELEMENT_NODE) {
									return;
								}
								const inertElements = slice.call(node.querySelectorAll('[inert]'));
								if (matches.call(node, '[inert]')) {
									inertElements.unshift(node);
								}
								inertElements.forEach(function (inertElement) {
									this.setInert(inertElement, true);
								}, _this);
							}, _this);
							break;
						case 'attributes':
							if (record.attributeName !== 'inert') {
								return;
							}
							const target = /** @type {!HTMLElement} */ (record.target);
							const inert = target.hasAttribute('inert');
							_this.setInert(target, inert);
							break;
					}
				}, this);
			}
		}

		/**
		 * Recursively walk the composed tree from |node|.
		 * @param {!Node} node
		 * @param {(function (!HTMLElement))=} callback Callback to be called for each element traversed,
		 *     before descending into child nodes.
		 * @param {?ShadowRoot=} shadowRootAncestor The nearest ShadowRoot ancestor, if any.
		 */
		function composedTreeWalk(node, callback, shadowRootAncestor) {
			if (node.nodeType == Node.ELEMENT_NODE) {
				const element = /** @type {!HTMLElement} */ (node);
				if (callback) {
					callback(element);
				}

				// Descend into node:
				// If it has a ShadowRoot, ignore all child elements - these will be picked
				// up by the <content> or <shadow> elements. Descend straight into the
				// ShadowRoot.
				const shadowRoot = /** @type {!HTMLElement} */ (element).shadowRoot;
				if (shadowRoot) {
					composedTreeWalk(shadowRoot, callback, shadowRoot);
					return;
				}

				// If it is a <content> element, descend into distributed elements - these
				// are elements from outside the shadow root which are rendered inside the
				// shadow DOM.
				if (element.localName == 'content') {
					const content = /** @type {!HTMLContentElement} */ (element);
					// Verifies if ShadowDom v0 is supported.
					const distributedNodes = content.getDistributedNodes ?
						content.getDistributedNodes() : [];
					for (let i = 0; i < distributedNodes.length; i++) {
						composedTreeWalk(distributedNodes[i], callback, shadowRootAncestor);
					}
					return;
				}

				// If it is a <slot> element, descend into assigned nodes - these
				// are elements from outside the shadow root which are rendered inside the
				// shadow DOM.
				if (element.localName == 'slot') {
					const slot = /** @type {!HTMLSlotElement} */ (element);
					// Verify if ShadowDom v1 is supported.
					const distributedNodes = slot.assignedNodes ?
						slot.assignedNodes({ flatten: true }) : [];
					for (let i = 0; i < distributedNodes.length; i++) {
						composedTreeWalk(distributedNodes[i], callback, shadowRootAncestor);
					}
					return;
				}
			}

			// If it is neither the parent of a ShadowRoot, a <content> element, a <slot>
			// element, nor a <shadow> element recurse normally.
			let child = node.firstChild;
			while (child != null) {
				composedTreeWalk(child, callback, shadowRootAncestor);
				child = child.nextSibling;
			}
		}

		/**
		 * Adds a style element to the node containing the inert specific styles
		 * @param {!Node} node
		 */
		function addInertStyle(node) {
			if (node.querySelector('style#inert-style, link#inert-style')) {
				return;
			}
			const style = document.createElement('style');
			style.setAttribute('id', 'inert-style');
			style.textContent = '\n' +
				'[inert] {\n' +
				'  pointer-events: none;\n' +
				'  cursor: default;\n' +
				'}\n' +
				'\n' +
				'[inert], [inert] * {\n' +
				'  -webkit-user-select: none;\n' +
				'  -moz-user-select: none;\n' +
				'  -ms-user-select: none;\n' +
				'  user-select: none;\n' +
				'}\n';
			node.appendChild(style);
		}

		if (!HTMLElement.prototype.hasOwnProperty('inert')) {
			/** @type {!InertManager} */
			const inertManager = new InertManager(document);

			Object.defineProperty(HTMLElement.prototype, 'inert', {
				enumerable: true,
				/** @this {!HTMLElement} */
				get: function () {
					return this.hasAttribute('inert');
				},
				/** @this {!HTMLElement} */
				set: function (inert) {
					inertManager.setInert(this, inert);
				},
			});
		}
	})();
}
//====================================================================================================================
export function menuBurger() {
	const menuIcon = document.querySelector('.menu-icon');
	const menu = document.querySelector('.menu');
	const menuItems = document.querySelectorAll('.menu__item');
	const body = document.querySelector('body');
	// const headerBtn = document.querySelector('.header__btn');
	const wrapper = document.querySelector('.wrapper');
	const wrapperArray = Array.from(wrapper.children);
	const header = document.querySelector('.header');
	const logo = header.querySelector('.header__logo');
	// const lockPadding = window.innerWidth - document.querySelector('.wrapper').offsetWidth + 'px';

	if (menuIcon && menu) {
		menuIcon.addEventListener("click", () => {
			menu.classList.toggle('_active');
			body.classList.toggle('_lock');
			menuIcon.classList.toggle('_check');
			if (menuIcon.classList.toggle('_active')) {
				for (let index = 0; index < wrapperArray.length; index++) {
					const element = wrapperArray[index];
					if (element !== header) {
						element.inert = true;
						element.setAttribute('aria-hidden', 'true');
						element.setAttribute('tabindex', '-1');
					}
				}
				logo.inert = true;
				logo.setAttribute('aria-hidden', 'true');
				logo.setAttribute('tabindex', '-1');

				menuItems.forEach(menuItem => {
					menuItem.inert = false;
					menuItem.setAttribute('aria-hidden', 'false');
					menuItem.setAttribute('tabindex', '0');
				});


				// headerBtn.inert = true;
				// headerBtn.setAttribute('aria-hidden', 'true');
				// headerBtn.setAttribute('tabindex', '-1');

				setTimeout(() => {
					menuIcon.setAttribute('tabindex', '1');
				}, 300);
			} else {
				for (let index = 0; index < wrapperArray.length; index++) {
					const element = wrapperArray[index];
					if (element !== header) {
						element.inert = false;
						element.setAttribute('aria-hidden', 'false');
						element.setAttribute('tabindex', '0');
					}
				}
				logo.inert = false;
				logo.setAttribute('aria-hidden', 'false');
				logo.setAttribute('tabindex', '0');

				menuItems.forEach(menuItem => {
					menuItem.inert = true;
					menuItem.setAttribute('aria-hidden', 'true');
					menuItem.setAttribute('tabindex', '-1');
				});

				// headerBtn.inert = false;
				// headerBtn.setAttribute('aria-hidden', 'false');
				// headerBtn.setAttribute('tabindex', '0');

				setTimeout(() => {
					menuIcon.setAttribute('tabindex', '0');
				}, 300);
			}
		});
	}
}
//=============================================================================================================================================
export function useDynamicAdapt(type = 'max') {
	const className = '_dynamic_adapt_'
	const attrName = 'data-da'

	/** @type {dNode[]} */
	const dNodes = getDNodes()

	/** @type {dMediaQuery[]} */
	const dMediaQueries = getDMediaQueries(dNodes)

	dMediaQueries.forEach((dMediaQuery) => {
		const matchMedia = window.matchMedia(dMediaQuery.query)
		// массив объектов с подходящим брейкпоинтом
		const filteredDNodes = dNodes.filter(({ breakpoint }) => breakpoint === dMediaQuery.breakpoint)
		const mediaHandler = getMediaHandler(matchMedia, filteredDNodes)
		matchMedia.addEventListener('change', mediaHandler)

		mediaHandler()
	})

	function getDNodes() {
		const result = []
		const elements = [...document.querySelectorAll(`[${attrName}]`)]

		elements.forEach((element) => {
			const attr = element.getAttribute(attrName)
			const [toSelector, breakpoint, order] = attr.split(',').map((val) => val.trim())

			const to = document.querySelector(toSelector)

			if (to) {
				result.push({
					parent: element.parentElement,
					element,
					to,
					breakpoint: breakpoint ?? '767',
					order: order !== undefined ? (isNumber(order) ? Number(order) : order) : 'last',
					index: -1,
				})
			}
		})

		return sortDNodes(result)
	}

	/**
	 * @param {dNode} items
	 * @returns {dMediaQuery[]}
	 */
	function getDMediaQueries(items) {
		const uniqItems = [...new Set(items.map(({ breakpoint }) => `(${type}-width: ${breakpoint}px),${breakpoint}`))]

		return uniqItems.map((item) => {
			const [query, breakpoint] = item.split(',')

			return { query, breakpoint }
		})
	}

	/**
	 * @param {MediaQueryList} matchMedia
	 * @param {dNodes} items
	 */
	function getMediaHandler(matchMedia, items) {
		return function mediaHandler() {
			if (matchMedia.matches) {
				items.forEach((item) => {
					moveTo(item)
				})

				items.reverse()
			} else {
				items.forEach((item) => {
					if (item.element.classList.contains(className)) {
						moveBack(item)
					}
				})

				items.reverse()
			}
		}
	}

	/**
	 * @param {dNode} dNode
	 */
	function moveTo(dNode) {
		const { to, element, order } = dNode
		dNode.index = getIndexInParent(dNode.element, dNode.element.parentElement)
		element.classList.add(className)

		if (order === 'last' || order >= to.children.length) {
			to.append(element)

			return
		}

		if (order === 'first') {
			to.prepend(element)

			return
		}

		to.children[order].before(element)
	}

	/**
	 * @param {dNode} dNode
	 */
	function moveBack(dNode) {
		const { parent, element, index } = dNode
		element.classList.remove(className)

		if (index >= 0 && parent.children[index]) {
			parent.children[index].before(element)
		} else {
			parent.append(element)
		}
	}

	/**
	 * @param {HTMLElement} element
	 * @param {HTMLElement} parent
	 */
	function getIndexInParent(element, parent) {
		return [...parent.children].indexOf(element)
	}

	/**
	 * Функция сортировки массива по breakpoint и order
	 * по возрастанию для type = min
	 * по убыванию для type = max
	 *
	 * @param {dNode[]} items
	 */
	function sortDNodes(items) {
		const isMin = type === 'min' ? 1 : 0

		return [...items].sort((a, b) => {
			if (a.breakpoint === b.breakpoint) {
				if (a.order === b.order) {
					return 0
				}

				if (a.order === 'first' || b.order === 'last') {
					return -1 * isMin
				}

				if (a.order === 'last' || b.order === 'first') {
					return 1 * isMin
				}

				return 0
			}

			return (a.breakpoint - b.breakpoint) * isMin
		})
	}

	function isNumber(value) {
		return !isNaN(value)
	}
}
//=============================================================================================================================================
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
//=============================================================================================================================================
export function spollersInit() {
	const spollersArray = document.querySelectorAll('[data-spollers]');
	if (spollersArray.length > 0) {
		const spollersRegular = Array.from(spollersArray).filter(function (item, index, self) {
			return !item.dataset.spollers.split(",")[0];
		});
		if (spollersRegular.length > 0) {
			initSpollers(spollersRegular)
		}
		const spollersMedia = Array.from(spollersArray).filter(function (item, index, self) {
			return item.dataset.spollers.split(",")[0];
		});
		if (spollersMedia.length > 0) {
			const breakpointsArray = [];
			spollersMedia.forEach(item => {
				const params = item.dataset.spollers;
				const breakpoint = {};
				const paramsArray = params.split(",");
				breakpoint.value = paramsArray[0];
				breakpoint.type = paramsArray[1] ? paramsArray[1].trim() : "max";
				breakpoint.item = item;
				breakpointsArray.push(breakpoint);
			});

			let mediaQueries = breakpointsArray.map(function (item) {
				return '(' + item.type + "-width: " + item.value + "px)," + item.value + ',' + item.type;
			});
			mediaQueries = mediaQueries.filter(function (item, index, self) {
				return self.indexOf(item) === index;
			});

			mediaQueries.forEach(breakpoint => {
				const paramsArray = breakpoint.split(",");
				const mediaBreakpoint = paramsArray[1];
				const mediaType = paramsArray[2];
				const matchMedia = window.matchMedia(paramsArray[0]);

				const spollersArray = breakpointsArray.filter(function (item) {
					if (item.value === mediaBreakpoint && item.type === mediaType) {
						return true;
					}
				});
				matchMedia.addListener(function () {
					initSpollers(spollersArray, matchMedia);
				});
				initSpollers(spollersArray, matchMedia);
			});
		}
		function initSpollers(spollersArray, matchMedia = false) {
			spollersArray.forEach(spollersBlock => {
				spollersBlock = matchMedia ? spollersBlock.item : spollersBlock;
				if (matchMedia.matches || !matchMedia) {
					spollersBlock.classList.add('_init');
					initSpollersBody(spollersBlock);
					spollersBlock.addEventListener("click", setSpollerAction);
				} else {
					spollersBlock.classList.remove('_init');
					initSpollersBody(spollersBlock, false);
					spollersBlock.removeEventListener("click", setSpollerAction)
				}
			});
		}
		function initSpollersBody(spollersBlock, hideSpollerBody = true) {
			const spollerTitles = spollersBlock.querySelectorAll('[data-spoller]');
			if (spollerTitles.length > 0) {
				spollerTitles.forEach(spollerTitle => {
					if (hideSpollerBody) {
						spollerTitle.removeAttribute('tabindex');
						if (!spollerTitle.classList.contains('_active')) {
							spollerTitle.nextElementSibling.hidden = true;
						}
					} else {
						spollerTitle.setAttribute('tabindex', '-1');
						spollerTitle.nextElementSibling.hidden = false;
					}
				});
			}
		}
		function setSpollerAction(e) {
			const el = e.target;
			if (el.hasAttribute('data-spoller') || el.closest('[data-spoller]')) {
				const spollerTitle = el.hasAttribute('data-spoller') ? el : el.closest('[data-spoller]');
				const spollersBlock = spollerTitle.closest('[data-spollers]');
				const oneSpoller = spollersBlock.hasAttribute('data-one-spoller') ? true : false;
				if (!spollersBlock.querySelectorAll('._slide').length) {
					if (oneSpoller && !spollerTitle.classList.contains('_active')) {
						hideSpollerBody(spollersBlock);
					}
					spollerTitle.classList.toggle('_active');
					_slideToggle(spollerTitle.nextElementSibling, 500);
				}
				e.preventDefault();
			}
		}
		function hideSpollerBody(spollersBlock) {
			const spollerActiveTitle = spollersBlock.querySelector('[data-spoller]._active')
			if (spollerActiveTitle) {
				spollerActiveTitle.classList.remove('_active');
				_slideUp(spollerActiveTitle.nextElementSibling, 500)
			}
		}
	}
	let _slideUp = (target, duration = 500) => {
		if (!target.classList.contains('_slide')) {
			target.classList.add('_slide')
			target.style.transitionProperty = 'height, margin, padding';
			target.style.transitionDuration = duration + 'ms';
			target.style.height = target.offsetHeight + 'px';
			target.offsetHeight;
			target.style.overflow = 'hidden';
			target.style.height = 0;
			target.style.paddingTop = 0;
			target.style.paddingBottom = 0;
			target.style.marginTop = 0;
			target.style.marginBottom = 0;
			window.setTimeout(() => {
				target.hidden = true;
				target.style.removeProperty('height');
				target.style.removeProperty('padding-top');
				target.style.removeProperty('padding-bottom');
				target.style.removeProperty('margin-top');
				target.style.removeProperty('margin-bottom');
				target.style.removeProperty('overflow');
				target.style.removeProperty('transition-duration');
				target.style.removeProperty('transition-property');
				target.classList.remove('_slide');
				//alert("!");
			}, duration);
		}
	}
	let _slideDown = (target, duration = 500) => {
		if (!target.classList.contains('_slide')) {
			target.classList.add('_slide');
			if (target.hidden) {
				target.hidden = false;
			}
			let height = target.offsetHeight;
			target.style.overflow = 'hidden';
			target.style.height = 0;
			target.style.paddingTop = 0;
			target.style.paddingBottom = 0;
			target.style.marginTop = 0;
			target.style.marginBottom = 0;
			target.offsetHeight;
			target.style.transitionProperty = "height, margin, padding";
			target.style.transitionDuration = duration + 'ms';
			target.style.height = height + 'px';
			target.style.removeProperty('padding-top');
			target.style.removeProperty('padding-bottom');
			target.style.removeProperty('margin-top');
			target.style.removeProperty('margin-bottom');
			window.setTimeout(() => {
				target.style.removeProperty('height');
				target.style.removeProperty('overflow');
				target.style.removeProperty('transition-duration');
				target.style.removeProperty('transition-property');
				target.classList.remove('_slide');
			}, duration);
		}
	}
	let _slideToggle = (target, duration = 500) => {
		if (target.hidden) {
			return _slideDown(target, duration);
		} else {
			return _slideUp(target, duration);
		}
	}
}
//=============================================================================================================================================
export function phoneMaskFunction() {
	const mask = (selector) => {
		function setMask() {
			let matrix = '+###############';

			maskList.forEach(item => {
				let code = item.code.replace(/[\s#]/g, ''),
					phone = this.value.replace(/[\s#-)(]/g, '');

				if (phone.includes(code)) {
					// console.log(phone, code);
					matrix = item.code;
				}
			});

			let i = 0,
				val = this.value.replace(/\D/g, '');

			this.value = matrix.replace(/(?!\+)./g, function (a) {
				return /[#\d]/.test(a) && i < val.length ? val.charAt(i++) : i >= val.length ? '' : a;
			});
		}

		let inputs = document.querySelectorAll(selector);

		inputs.forEach(input => {
			// if (!input.value) input.value = '+';
			input.addEventListener('input', setMask);
			input.addEventListener('focus', setMask);
			input.addEventListener('blur', setMask);
		});
	};
	const maskList = [
		{ "code": "+247 ####" },
		{ "code": "+290 ####" },
		{ "code": "+290 ####" },
		{ "code": "+683 ####" },
		{ "code": "+690 ####" },
		{ "code": "+500 #####" },
		{ "code": "+676 #####" },
		{ "code": "+677 #####" },
		{ "code": "+678 #####" },
		{ "code": "+688 2####" },
		{ "code": "+49 ### ###" },
		{ "code": "+682 ## ###" },
		{ "code": "+686 ## ###" },
		{ "code": "+688 90####" },
		{ "code": "+95 ### ###" },
		{ "code": "+298 ### ###" },
		{ "code": "+376 ### ###" },
		{ "code": "+387 ## ####" },
		{ "code": "+508 ## ####" },
		{ "code": "+597 ### ###" },
		{ "code": "+672 1## ###" },
		{ "code": "+672 3## ###" },
		{ "code": "+681 ## ####" },
		{ "code": "+685 ## ####" },
		{ "code": "+687 ## ####" },
		{ "code": "+850 ### ###" },
		{ "code": "+230 ### ####" },
		{ "code": "+239 ## #####" },
		{ "code": "+245 # ######" },
		{ "code": "+246 ### ####" },
		{ "code": "+263 # ######" },
		{ "code": "+269 ## #####" },
		{ "code": "+297 ### ####" },
		{ "code": "+299 ## ## ##" },
		{ "code": "+354 ### ####" },
		{ "code": "+372 ### ####" },
		{ "code": "+387 ## #####" },
		{ "code": "+49 ### ## ##" },
		{ "code": "+501 ### ####" },
		{ "code": "+507 ### ####" },
		{ "code": "+592 ### ####" },
		{ "code": "+597 ### ####" },
		{ "code": "+599 ### ####" },
		{ "code": "+599 ### ####" },
		{ "code": "+599 ### ####" },
		{ "code": "+60 # ### ###" },
		{ "code": "+62 ## ### ##" },
		{ "code": "+65 #### ####" },
		{ "code": "+670 ### ####" },
		{ "code": "+673 ### ####" },
		{ "code": "+674 ### ####" },
		{ "code": "+677 ### ####" },
		{ "code": "+678 ## #####" },
		{ "code": "+679 ## #####" },
		{ "code": "+680 ### ####" },
		{ "code": "+689 ## ## ##" },
		{ "code": "+691 ### ####" },
		{ "code": "+692 ### ####" },
		{ "code": "+95 # ### ###" },
		{ "code": "+960 ### ####" },
		{ "code": "+220 ### ## ##" },
		{ "code": "+232 ## ######" },
		{ "code": "+234 ## ### ##" },
		{ "code": "+237 #### ####" },
		{ "code": "+238 ### ## ##" },
		{ "code": "+248 # ### ###" },
		{ "code": "+252 # ### ###" },
		{ "code": "+252 # ### ###" },
		{ "code": "+265 1 ### ###" },
		{ "code": "+291 # ### ###" },
		{ "code": "+350 ### #####" },
		{ "code": "+356 #### ####" },
		{ "code": "+372 #### ####" },
		{ "code": "+373 #### ####" },
		{ "code": "+47 ### ## ###" },
		{ "code": "+49 ### ## ###" },
		{ "code": "+504 #### ####" },
		{ "code": "+505 #### ####" },
		{ "code": "+506 #### ####" },
		{ "code": "+52 ## ## ####" },
		{ "code": "+53 # ### ####" },
		{ "code": "+599 9### ####" },
		{ "code": "+60 ## ### ###" },
		{ "code": "+62 ## ### ###" },
		{ "code": "+64 ## ### ###" },
		{ "code": "+66 ## ### ###" },
		{ "code": "+670 77# #####" },
		{ "code": "+670 78# #####" },
		{ "code": "+850 #### ####" },
		{ "code": "+852 #### ####" },
		{ "code": "+853 #### ####" },
		{ "code": "+886 #### ####" },
		{ "code": "+95 ## ### ###" },
		{ "code": "+961 # ### ###" },
		{ "code": "+965 #### ####" },
		{ "code": "+967 # ### ###" },
		{ "code": "+973 #### ####" },
		{ "code": "+974 #### ####" },
		{ "code": "+975 # ### ###" },
		{ "code": "+1 ### ### ####" },
		{ "code": "+1 242 ### ####" },
		{ "code": "+1 246 ### ####" },
		{ "code": "+1 264 ### ####" },
		{ "code": "+1 268 ### ####" },
		{ "code": "+1 284 ### ####" },
		{ "code": "+1 340 ### ####" },
		{ "code": "+1 345 ### ####" },
		{ "code": "+1 441 ### ####" },
		{ "code": "+1 473 ### ####" },
		{ "code": "+1 649 ### ####" },
		{ "code": "+1 664 ### ####" },
		{ "code": "+1 670 ### ####" },
		{ "code": "+1 671 ### ####" },
		{ "code": "+1 684 ### ####" },
		{ "code": "+1 721 ### ####" },
		{ "code": "+1 758 ### ####" },
		{ "code": "+1 767 ### ####" },
		{ "code": "+1 784 ### ####" },
		{ "code": "+1 809 ### ####" },
		{ "code": "+1 829 ### ####" },
		{ "code": "+1 849 ### ####" },
		{ "code": "+1 868 ### ####" },
		{ "code": "+1 869 ### ####" },
		{ "code": "+1 876 ### ####" },
		{ "code": "+216 ## ### ###" },
		{ "code": "+218 ## ### ###" },
		{ "code": "+222 ## ## ####" },
		{ "code": "+223 ## ## ####" },
		{ "code": "+224 ## ### ###" },
		{ "code": "+225 ## ### ###" },
		{ "code": "+226 ## ## ####" },
		{ "code": "+227 ## ## ####" },
		{ "code": "+228 ## ### ###" },
		{ "code": "+229 ## ## ####" },
		{ "code": "+231 ## ### ###" },
		{ "code": "+234 ## ### ###" },
		{ "code": "+236 ## ## ####" },
		{ "code": "+241 # ## ## ##" },
		{ "code": "+252 ## ### ###" },
		{ "code": "+254 ### ######" },
		{ "code": "+257 ## ## ####" },
		{ "code": "+258 ## ### ###" },
		{ "code": "+262 ##### ####" },
		{ "code": "+262 ##### ####" },
		{ "code": "+266 # ### ####" },
		{ "code": "+267 ## ### ###" },
		{ "code": "+268 ## ## ####" },
		{ "code": "+27 ## ### ####" },
		{ "code": "+31 ## ### ####" },
		{ "code": "+32 ### ### ###" },
		{ "code": "+33 ### ### ###" },
		{ "code": "+34 ### ### ###" },
		{ "code": "+357 ## ### ###" },
		{ "code": "+36 ### ### ###" },
		{ "code": "+370 ### ## ###" },
		{ "code": "+371 ## ### ###" },
		{ "code": "+374 ## ### ###" },
		{ "code": "+377 ## ### ###" },
		{ "code": "+382 ## ### ###" },
		{ "code": "+385 ## ### ###" },
		{ "code": "+386 ## ### ###" },
		{ "code": "+389 ## ### ###" },
		{ "code": "+39 6 698 #####" },
		{ "code": "+40 ## ### ####" },
		{ "code": "+41 ## ### ####" },
		{ "code": "+45 ## ## ## ##" },
		{ "code": "+46 ## ### ####" },
		{ "code": "+48 ### ### ###" },
		{ "code": "+49 ### ## ####" },
		{ "code": "+502 # ### ####" },
		{ "code": "+503 ## ## ####" },
		{ "code": "+509 ## ## ####" },
		{ "code": "+51 ### ### ###" },
		{ "code": "+56 # #### ####" },
		{ "code": "+591 # ### ####" },
		{ "code": "+593 # ### ####" },
		{ "code": "+594 ##### ####" },
		{ "code": "+60 ## ### ####" },
		{ "code": "+60 ### ### ###" },
		{ "code": "+61 # #### ####" },
		{ "code": "+62 ## ### ####" },
		{ "code": "+62 8## ### ###" },
		{ "code": "+64 ### ### ###" },
		{ "code": "+66 ## ### ####" },
		{ "code": "+675 ### ## ###" },
		{ "code": "+81 ### ### ###" },
		{ "code": "+82 ## ### ####" },
		{ "code": "+84 ## #### ###" },
		{ "code": "+850 ## ### ###" },
		{ "code": "+855 ## ### ###" },
		{ "code": "+856 ## ### ###" },
		{ "code": "+880 ## ### ###" },
		{ "code": "+93 ## ### ####" },
		{ "code": "+94 ## ### ####" },
		{ "code": "+961 ## ### ###" },
		{ "code": "+966 # ### ####" },
		{ "code": "+967 ## ### ###" },
		{ "code": "+968 ## ### ###" },
		{ "code": "+971 # ### ####" },
		{ "code": "+972 # ### ####" },
		{ "code": "+975 17 ### ###" },
		{ "code": "+976 ## ## ####" },
		{ "code": "+977 ## ### ###" },
		{ "code": "+993 # ### ####" },
		{ "code": "+20 ### ### ####" },
		{ "code": "+211 ## ### ####" },
		{ "code": "+212 ## #### ###" },
		{ "code": "+213 ## ### ####" },
		{ "code": "+218 21 ### ####" },
		{ "code": "+221 ## ### ####" },
		{ "code": "+233 ### ### ###" },
		{ "code": "+235 ## ## ## ##" },
		{ "code": "+240 ## ### ####" },
		{ "code": "+242 ## ### ####" },
		{ "code": "+243 ### ### ###" },
		{ "code": "+244 ### ### ###" },
		{ "code": "+249 ## ### ####" },
		{ "code": "+250 ### ### ###" },
		{ "code": "+251 ## ### ####" },
		{ "code": "+253 ## ## ## ##" },
		{ "code": "+255 ## ### ####" },
		{ "code": "+256 ### ### ###" },
		{ "code": "+260 ## ### ####" },
		{ "code": "+261 ## ## #####" },
		{ "code": "+264 ## ### ####" },
		{ "code": "+265 # #### ####" },
		{ "code": "+30 ### ### ####" },
		{ "code": "+351 ## ### ####" },
		{ "code": "+352 ### ### ###" },
		{ "code": "+353 ### ### ###" },
		{ "code": "+355 ### ### ###" },
		{ "code": "+359 ### ### ###" },
		{ "code": "+377 ### ### ###" },
		{ "code": "+378 #### ######" },
		{ "code": "+381 ## ### ####" },
		{ "code": "+39 ### #### ###" },
		{ "code": "+420 ### ### ###" },
		{ "code": "+421 ### ### ###" },
		{ "code": "+43 ### ### ####" },
		{ "code": "+44 ## #### ####" },
		{ "code": "+49 ### ### ####" },
		{ "code": "+52 ### ### ####" },
		{ "code": "+54 ### ### ####" },
		{ "code": "+55 ## #### ####" },
		{ "code": "+55 ## 7### ####" },
		{ "code": "+57 ### ### ####" },
		{ "code": "+58 ### ### ####" },
		{ "code": "+590 ### ### ###" },
		{ "code": "+593 ## ### ####" },
		{ "code": "+595 ### ### ###" },
		{ "code": "+598 # ### ## ##" },
		{ "code": "+62 8## ### ####" },
		{ "code": "+63 ### ### ####" },
		{ "code": "+64 ### ### ####" },
		{ "code": "+7 ### ### ## ##" },
		{ "code": "+7 6## ### ## ##" },
		{ "code": "+7 7## ### ## ##" },
		{ "code": "+81 ## #### ####" },
		{ "code": "+84 ### #### ###" },
		{ "code": "+86 ### #### ###" },
		{ "code": "+886 # #### ####" },
		{ "code": "+90 ### ### ####" },
		{ "code": "+91 #### ### ###" },
		{ "code": "+92 ### ### ####" },
		{ "code": "+962 # #### ####" },
		{ "code": "+963 ## #### ###" },
		{ "code": "+966 5 #### ####" },
		{ "code": "+967 ### ### ###" },
		{ "code": "+970 ## ### ####" },
		{ "code": "+971 5# ### ####" },
		{ "code": "+972 5# ### ####" },
		{ "code": "+98 ### ### ####" },
		{ "code": "+992 ## ### ####" },
		{ "code": "+995 ### ### ###" },
		{ "code": "+996 ### ### ###" },
		{ "code": "+998 ## ### ####" },
		{ "code": "+234 ### ### ####" },
		{ "code": "+234 ### ### ####" },
		{ "code": "+375 ## ### ## ##" },
		{ "code": "+380 ## ### ## ##" },
		{ "code": "+423 ### ### ####" },
		{ "code": "+49 #### ### ####" },
		{ "code": "+55 ## 9#### ####" },
		{ "code": "+596 ### ## ## ##" },
		{ "code": "+850 ### #### ###" },
		{ "code": "+850 191 ### ####" },
		{ "code": "+856 20## ### ###" },
		{ "code": "+86 ### #### ####" },
		{ "code": "+964 ### ### ####" },
		{ "code": "+994 ## ### ## ##" },
		{ "code": "+358 ### ### ## ##" },
		{ "code": "+62 8## ### ## ###" },
		{ "code": "+86 ## ##### #####" },
		{ "code": "+850 #### #############" }
	];

	mask('[data-tel-input]');

	const phoneInputs = document.querySelectorAll('[data-tel-input]');
	phoneInputs.forEach((phoneInput) => {
		phoneInput.addEventListener('input', () => {
			if (phoneInput.value == '+') phoneInput.value = '';
		});
		phoneInput.addEventListener('blur', () => {
			if (phoneInput.value == '+') phoneInput.value = '';
		});
	});

}
//=============================================================================================================================================
export function custumSelectFunction() {

	document.querySelectorAll('.dropdown').forEach((dropdownWrapper) => {

		const dropDownBtn = dropdownWrapper.querySelector('.dropdown__btn');
		const dropdownList = dropdownWrapper.querySelector('.dropdown__list');
		const dropdownListItems = dropdownList.querySelectorAll('.dropdown__list-item');
		const dropDownInput = dropdownWrapper.querySelector('.dropdown__input');

		dropDownBtn.addEventListener('click', function () {
			this.classList.toggle('_active');
			dropdownList.classList.toggle('_open');
			dropDownBtn.setAttribute('aria-expanded', 'true');
		});

		dropdownListItems.forEach(listItem => {
			listItem.addEventListener('click', (e) => {
				dropDownBtn.innerText = listItem.dataset.value;
				dropDownBtn.focus();
				dropDownInput.value = listItem.dataset.value;
				dropdownList.classList.remove('_open');
				dropDownBtn.classList.remove('_active');
				dropDownBtn.classList.add('_checked');

				dropdownListItems.forEach(listItem => {
					listItem.setAttribute('aria-selected', 'false');
				});
				listItem.setAttribute('aria-selected', 'true');

				dropDownBtn.setAttribute('aria-expanded', 'false');
				e.stopPropagation();
			});
			listItem.addEventListener('keydown', (e) => {
				if (e.key !== 'Tab') {
					if (dropDownBtn.innerText = listItem.dataset.value) {
						dropDownBtn.classList.add('_checked');
						dropDownBtn.focus();
					}
					dropDownBtn.classList.remove('_active');
					dropdownList.classList.remove('_open');
					dropDownBtn.setAttribute('aria-expanded', 'false');
				}
			});
		});

		document.addEventListener('click', (e) => {
			if (e.target !== dropDownBtn) {
				dropdownList.classList.remove('_open');
				dropDownBtn.classList.remove('_active');
				dropDownBtn.setAttribute('aria-expanded', 'false');
			}
		});

		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				dropdownList.classList.remove('_open');
				dropDownBtn.classList.remove('_active');
				dropDownBtn.setAttribute('aria-expanded', 'false');
			}
		});
	});
}
//=============================================================================================================================================
export function validationFormFunction() {
	const requestForm = document.getElementById('request-form');
	const footerForm = document.getElementById('form-footer');

	requestForm.addEventListener('submit', requestFormSend);
	footerForm.addEventListener('submit', footerFormSend);

	function requestFormSend(e) {
		e.preventDefault();
		let requestError = validateForm(requestForm);

		if (requestError !== 0) {
			alert('Заполните обязательные поля!!!');
		}
	}

	function footerFormSend(e) {
		e.preventDefault();
		let footerError = validateForm(footerForm);

		if (footerError !== 0) {
			alert('Заполните обязательные поля!!!');
		}
	}

	function validateForm(form) {
		let error = 0;
		let formReq = form.querySelectorAll('._req');

		formReq.forEach((input) => {
			removeError(input);
			if (input.classList.contains('_email')) {
				if (emailTest(input)) {
					addError(input);
					error++;
				}
			} else {
				if (input.value === '') {
					addError(input);
					error++;
				}
			}
		});

		return error;
	}

	function addError(input) {
		input.parentElement.classList.add('_error');
		input.classList.add('_error');
	}

	function removeError(input) {
		input.parentElement.classList.remove('_error');
		input.classList.remove('_error');
	}

	function emailTest(input) {
		return !/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,8})+$/.test(input.value);
	}
}
//=============================================================================================================================================
export function animationFunction() {

	const animItems = document.querySelectorAll('._anim-init');
	if (animItems.length > 0) {

		window.addEventListener('scroll', animOnScroll);
		document.addEventListener('DOMContentLoaded', animOnScroll);

		function animOnScroll() {
			for (let index = 0; index < animItems.length; index++) {
				const animItem = animItems[index];
				const animItemHeight = animItem.offsetHeight;
				const animItemOffSet = offSet(animItem).top;
				const animStart = 4;

				let animItemPoint = window.innerHeight - animItemHeight / animStart;
				if (innerHeight > window.innerHeight) {
					animItemPoint = window.innerHeight - window.innerHeight / animStart;
				}

				if ((scrollY > animItemOffSet - animItemPoint) && scrollY < (animItemOffSet + animItemHeight)) {
					animItem.classList.add('_active');
				} else {
					if (!animItem.classList.contains('_anim-no-hide')) {
						animItem.classList.remove('_active');
					}
				}
			}
		}

		function offSet(el) {
			const rect = el.getBoundingClientRect(),
				scrollLeft = window.scrollX || document.documentElement.scrollLeft,
				scrollTop = window.scrollY || document.documentElement.scrollTop;
			return { top: rect.top + scrollTop, left: rect.left + scrollLeft }
		}
		setTimeout(() => {
			animOnScroll();
		}, 200);

	}
}
