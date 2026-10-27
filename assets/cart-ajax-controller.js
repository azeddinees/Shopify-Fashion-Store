(() => {
  const MAX_SECTIONS = 5;

  class CartAjaxController {
    static get root() {
      return window.Shopify?.routes?.root || '/';
    }

    constructor(options = {}) {
      this.sections = options.sections ?? CartAjaxController.readSectionsFromDom();
    }

    static readSectionsFromDom() {
      const raw = document.body?.dataset?.cartSections || '';
      return raw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, MAX_SECTIONS);
    }

    async addItem(variantId, { quantity = 1, properties, sections = this.sections } = {}) {
      const item = { id: Number(variantId), quantity: Number(quantity) || 1 };
      if (properties) item.properties = properties;
      return this.addItems([item], { sections });
    }

    async addItems(items = [], { sections = this.sections } = {}) {
      const payload = {
        items: items.map((item) => {
          const next = {
            id: Number(item.id),
            quantity: Number(item.quantity) || 1,
          };
          if (item.properties) next.properties = item.properties;
          return next;
        }),
      };

      if (sections?.length) {
        payload.sections = sections.join(',');
        payload.sections_url = `${CartAjaxController.root}cart`;
      }

      const response = await fetch(`${CartAjaxController.root}cart/add.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.description || error.message || 'Cart add failed');
      }

      const data = await response.json();

      if (data.sections) {
        this.renderSections(data.sections);
      }

      this.publish(data);
      this.openDrawer();

      return data;
    }

    async refreshSections(sections = this.sections) {
      if (!sections?.length) return {};

      const params = new URLSearchParams({
        sections: sections.slice(0, MAX_SECTIONS).join(','),
      });
      const response = await fetch(`${CartAjaxController.root}?${params}`);

      if (!response.ok) throw new Error('Section refresh failed');

      const data = await response.json();
      this.renderSections(data);
      return data;
    }

    renderSections(sections = {}) {
      Object.entries(sections).forEach(([id, html]) => {
        if (!html) return;
        const current = document.getElementById(`shopify-section-${id}`);
        if (!current) return;
        current.outerHTML = html;
      });
    }

    openDrawer() {
      const drawer = document.querySelector('cart-drawer, [data-cart-drawer]');
      if (!drawer) return;

      if (typeof drawer.open === 'function') {
        drawer.open();
        return;
      }

      if (typeof drawer.showModal === 'function') {
        drawer.showModal();
        return;
      }

      drawer.removeAttribute('hidden');
      drawer.setAttribute('open', '');
    }

    publish(detail) {
      document.documentElement.dispatchEvent(
        new CustomEvent('cart:updated', {
          bubbles: true,
          detail,
        })
      );
    }
  }

  const controller = new CartAjaxController();
  window.CartAjax = controller;

  window.addUpsellToCart = (variantId, quantity = 1) =>
    controller.addItem(variantId, { quantity });
})();
