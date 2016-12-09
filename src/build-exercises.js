// This scripts generates ./public/scripts/exercices.js based on ./*.md files

var _ = require('lodash');
var fs = require('fs');
var mustache = require('mustache');
var QuizzRenderer = require('./QuizzRenderer');

var PATH_SOURCE = './exam-data/';
var OUTPUT_FILE = './public/scripts/exam-data.js';

var CONFIG_FILE = '../' + PATH_SOURCE + 'exam-config.js';

var RE_TEMPLATE_FILE = /ex\.(\d+)\.(code|quizz)\.template\.md/;

function makeRegexTester(regex) {
  return regex.test.bind(regex);
}

function renderExercisesFile(exercises) {
  var config = require(CONFIG_FILE);
  return [
    '// generated by build-exercises.js',
    '(function(document) {',
    '  \'use strict\';',
    '  var app = document.querySelector(\'#app\');',
    '  app.config = '
      + JSON.stringify(config, null, 2).replace(/\n/g, '\n  ') + ';',
    '  app.exercises = '
      + JSON.stringify(exercises, null, 2).replace(/\n/g, '\n  ') + ';',
    '})(document);',
    ''
  ].join('\n');
}

// converters

function renderCodeExercise(exerciseData, exNumber) {

  var evalTests = [];

  var questions = exerciseData.renderJsonQuestions().map(function(question, q) {
    var variants = _.map(question.choices, 'text').map(JSON.parse);
    variants = variants.length > 0 ? variants : [{}]; // also render coding questions that don't have any variants
    var exText = question.md;
    var exEval = question.mdSolution;
    var exSolution = null;
    if (exEval) {
      var parts = exEval.split('\n--\n');
      exEval = parts.pop(); // evaluation code
      exEval = exEval.replace(/```js\n*/g, '').replace(/```\n*/g, '');
      exSolution = parts.pop();
    }
    var exerciseData = {
      i: q + 1, // TODO: prevent id collisions if more than one code.template.md file is used
      id: 'code' + (q + 1), // TODO: allow each question to override this id
      variants: variants,
      testVariants: variants.map(function renderVariant(variantData, i) {
        return exEval && mustache.render(exEval, variantData);
      })
    };
    evalTests.push(exerciseData);
    return Object.assign({}, exerciseData, {
      mdVariants: variants.map(function renderVariant(variantData, i) {
        return mustache.render(exText, variantData);
      }),
      mdSolution: exSolution // TODO: one exSolution per variant? (like for testVariants)
    });
    // TODO: obfuscate solution and tests on client-side
  });

  // generate solution file, for evaluation of students' answers using QuizzEvaluator.js
  var solFile = PATH_SOURCE + 'ex.' + exNumber + '.code.tests.json';
  fs.writeFileSync(solFile, JSON.stringify(evalTests, null, 2));

  return {
    isCode: true,
    title: 'Exercices de codage',
    questions: questions,
  };
}

function renderQuizzExercise(exerciseData, exNumber) {
  var solutions = exerciseData.getSolutions();
  // generate solution file, for evaluation of students' answers using QuizzEvaluator.js
  var solFile = PATH_SOURCE + 'ex.' + exNumber + '.quizz.solutions.json';
  fs.writeFileSync(solFile, JSON.stringify(solutions, null, 2));
  // return rendered questions, for web client
  return {
    isQuizz: true,
    title: 'QCM',
    questions: exerciseData.renderJsonQuestions(),
    solutions: solutions
  };
}

var converters = {
  code: renderCodeExercise,
  quizz: renderQuizzExercise
};

// actual script

var files = fs.readdirSync(PATH_SOURCE).sort();
var exercises = [];

files.filter(makeRegexTester(RE_TEMPLATE_FILE)).forEach(function(file){
  var fileParts = RE_TEMPLATE_FILE.exec(file);
  var exNumber = fileParts[1];
  var exType = fileParts[2];
  console.log('Rendering exam and solution files from', file, '...');
  var exerciseData = new QuizzRenderer().readFromFile(PATH_SOURCE + file);
  exercises.push(_.extend({
    _info: 'generated from ' + file,
    i: exNumber
  }, converters[exType](exerciseData, exNumber)));
});

// the exercisePack file will be loaded by index.html, then processed by app.js for rendering
// exercises and student-id-based variants
var exercisePack = renderExercisesFile(exercises);
fs.writeFileSync(OUTPUT_FILE, exercisePack);
