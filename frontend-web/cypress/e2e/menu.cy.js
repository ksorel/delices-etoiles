describe('Menu Page', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/menu');
  });

  it('should display menu items', () => {
    cy.intercept('GET', '/api/menu/dishes', {
      fixture: 'dishes.json'
    }).as('getDishes');

    cy.wait('@getDishes');
    cy.contains('Riz Tchép').should('be.visible');
    cy.contains('4500 XOF').should('be.visible');
  });

  it('should add item to cart', () => {
    cy.get('[data-testid="dish-1"]').within(() => {
      cy.contains('Ajouter au panier').click();
    });

    cy.get('[data-testid="cart-badge"]').should('contain', '1');
  });
});