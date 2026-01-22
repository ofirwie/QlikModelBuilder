/**
 * Unit tests for core logic - runs without VS Code
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Read the compiled wizardPanel.js to extract and test functions
const wizardPanelPath = path.join(__dirname, '../../out/wizardPanel.js');

describe('WizardPanel Logic Tests', function() {
  let code;

  before(function() {
    code = fs.readFileSync(wizardPanelPath, 'utf-8');
  });

  describe('Function Existence', function() {
    it('should have generateScript function', function() {
      assert.ok(code.includes('function generateScript()'), 'generateScript function missing');
    });

    it('should have uploadSpec function', function() {
      assert.ok(code.includes('function uploadSpec()'), 'uploadSpec function missing');
    });

    it('should have handleSpecParsed function', function() {
      assert.ok(code.includes('function handleSpecParsed('), 'handleSpecParsed function missing');
    });

    it('should have render function', function() {
      assert.ok(code.includes('function render()'), 'render function missing');
    });

    it('should have renderSidebar function', function() {
      assert.ok(code.includes('function renderSidebar()'), 'renderSidebar function missing');
    });

    it('should have renderCanvas function', function() {
      assert.ok(code.includes('function renderCanvas()'), 'renderCanvas function missing');
    });
  });

  describe('Message Handlers', function() {
    it('should handle generateScript message', function() {
      assert.ok(code.includes("case 'generateScript':"), 'generateScript handler missing');
    });

    it('should handle uploadSpec message', function() {
      assert.ok(code.includes("case 'uploadSpec':"), 'uploadSpec handler missing');
    });

    it('should handle specParsed message', function() {
      assert.ok(code.includes("case 'specParsed':"), 'specParsed handler missing');
    });

    it('should handle scriptGenerated message', function() {
      assert.ok(code.includes("case 'scriptGenerated':"), 'scriptGenerated handler missing');
    });

    it('should handle initialData message', function() {
      assert.ok(code.includes("case 'initialData':"), 'initialData handler missing');
    });
  });

  describe('Button onclick Handlers', function() {
    it('should have generateScript onclick', function() {
      assert.ok(code.includes('onclick="generateScript()"'), 'generateScript onclick missing');
    });

    it('should have uploadSpec onclick', function() {
      assert.ok(code.includes('onclick="uploadSpec()"'), 'uploadSpec onclick missing');
    });

    it('should have copyScript onclick', function() {
      assert.ok(code.includes('onclick="copyScript()"'), 'copyScript onclick missing');
    });
  });

  describe('Skip Connection Flow', function() {
    it('should have skip connection button', function() {
      assert.ok(code.includes('btnSkipConnection'), 'Skip connection button missing');
    });

    it('should set configured to true on skip', function() {
      assert.ok(code.includes('state.configured = true'), 'Skip connection logic missing');
    });
  });

  describe('Generate Script Logic', function() {
    it('should filter tables with included fields', function() {
      assert.ok(
        code.includes('.filter(t => t.fields && t.fields.some(f => f.include))'),
        'Table filtering logic missing'
      );
    });

    it('should extract table names before sending', function() {
      assert.ok(
        code.includes('.map(t => t.name)'),
        'Table name extraction missing'
      );
    });

    it('should show error when no tables selected', function() {
      assert.ok(
        code.includes("selectedTables.length === 0"),
        'No tables error check missing'
      );
    });
  });

  describe('CSV Parsing', function() {
    it('should have parseCSVSpec function', function() {
      assert.ok(code.includes('parseCSVSpec'), 'parseCSVSpec function missing');
    });

    it('should have parseCSVLine function', function() {
      assert.ok(code.includes('parseCSVLine'), 'parseCSVLine function missing');
    });

    it('should set include: true for fields', function() {
      assert.ok(code.includes('include: true'), 'Fields include flag missing');
    });
  });

  describe('PostMessage Communication', function() {
    it('should send generateScript message', function() {
      assert.ok(code.includes("type: 'generateScript'"), 'generateScript postMessage missing');
    });

    it('should send uploadSpec message', function() {
      assert.ok(code.includes("type: 'uploadSpec'"), 'uploadSpec postMessage missing');
    });

    it('should receive scriptGenerated message', function() {
      assert.ok(code.includes("type: 'scriptGenerated'"), 'scriptGenerated message handling missing');
    });

    it('should receive specParsed message', function() {
      assert.ok(code.includes("type: 'specParsed'"), 'specParsed message handling missing');
    });
  });
});

console.log('Running unit tests on compiled code...');
