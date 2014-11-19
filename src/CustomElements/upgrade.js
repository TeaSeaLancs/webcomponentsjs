/*
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

/**
 * Implements custom element upgrading
 * @module upgrade
*/

CustomElements.addModule(function(scope) {

// imports
var flags = scope.flags;

/**
 * Upgrade an element to a custom element. Upgrading an element
 * causes the custom prototype to be applied, an `is` attribute
 * to be attached (as needed), and invocation of the `readyCallback`.
 * If the element is in the main document, the `attachedkCallback` method
 * will be invoked.
 * `upgrade` does nothing if the element is already upgraded, or
 * if it matches no registered custom tag name.
 *
 * @method ugprade
 * @param {Element} element The element to upgrade.
 * @return {Element} The upgraded element.
 */
// Upgrade a node if it can be upgraded and is not already.
function upgrade(node) {
  if (!node.__upgraded__ && (node.nodeType === Node.ELEMENT_NODE)) {
    var is = node.getAttribute('is');
    var definition = scope.getRegisteredDefinition(is || node.localName);
    if (definition) {
      if (is && definition.tag == node.localName) {
        return upgradeWithDefinition(node, definition);
      } else if (!is && !definition.extends) {
        return upgradeWithDefinition(node, definition);
      }
    }
  }
}

function upgradeWithDefinition(element, definition) {
  flags.upgrade && console.group('upgrade:', element.localName);
  // some definitions specify an 'is' attribute
  if (definition.is) {
    element.setAttribute('is', definition.is);
  }
  // make 'element' implement definition.prototype
  implementPrototype(element, definition);
  // flag as upgraded
  element.__upgraded__ = true;
  // lifecycle management
  created(element);
  // attachedCallback fires in tree order, call before recursing
  scope.attachedNode(element);
  // there should never be a shadow root on element at this point
  scope.upgradeSubtree(element);
  flags.upgrade && console.groupEnd();
  // OUTPUT
  return element;
}

//  Set __proto__ on supported platforms and use a mixin strategy when 
//  this is not supported; e.g. on IE10.
function implementPrototype(element, definition) {
  // prototype swizzling is best
  if (Object.__proto__) {
    // but if upgrade is asynchronous to element creation, we need to check for property alterations.
    generateCarry(element, definition.prototype, definition.native);
    element.__proto__ = definition.prototype;
  } else {
    // where above we can re-acquire inPrototype via
    // getPrototypeOf(Element), we cannot do so when
    // we use mixin, so we install a magic reference
    customMixin(element, definition.prototype, definition.native);
    element.__proto__ = definition.prototype;
  }
}

function iterateProperties(inTarget, inSrc, inNative, f) {
  // TODO(sjmiles): 'used' allows us to only copy the 'youngest' version of
  // any property. This set should be precalculated. We also need to
  // consider this for supporting 'super'.
  var used = {};
  var carry = {};
  // start with inSrc
  var p = inSrc;
  // The default is HTMLElement.prototype, so we add a test to avoid mixing in
  // native prototypes
  while (p !== inNative && p !== HTMLElement.prototype) {
    var keys = Object.getOwnPropertyNames(p);
    for (var i=0, k; k=keys[i]; i++) {
      if (!used[k]) {
	    // On some systems, createCallback is not synchronous, so check to see if
		// between creation and upgrading a value for this property has been defined.
	    var desc = Object.getOwnPropertyDescriptor(inTarget, k);
		var existing = !!(desc && 'value' in desc);
		if (existing)
		  carry[k] = desc.value;
			
        f(inTarget, p, k, existing);
        used[k] = 1;
      }
    }
    p = Object.getPrototypeOf(p);
  }
  
  // If any values got defined between creation and upgrade, carry them forth until
  // after the createCallback.
  if (Object.keys(carry).length)
    inTarget.__carry = carry;
}

function defineCustomProperty(e, p, k) {
  Object.defineProperty(e, k, Object.getOwnPropertyDescriptor(p, k));	
}

function deleteProperty(e, p, k, hasExisting) {
  if (hasExisting)
    delete e[k];
}

function generateCarry(inTarget, inSrc, inNative) {
  iterateProperties(inTarget, inSrc, inNative, deleteProperty);
}

function customMixin(inTarget, inSrc, inNative) {
  iterateProperties(inTarget, inSrc, inNative, defineCustomProperty);
}

function created(element) {
  // invoke createdCallback
  if (element.createdCallback) {
    element.createdCallback();
  }
  
  // Any carried values should be set here.
  if (element.__carry) {
    for (var k in element.__carry)
	  element[k] = element.__carry[k];
	  
	delete element.__carry;
	}
}

scope.upgrade = upgrade;
scope.upgradeWithDefinition = upgradeWithDefinition;
scope.implementPrototype = implementPrototype;

});
