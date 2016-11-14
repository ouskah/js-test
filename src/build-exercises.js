// This scripts generates ./public/scripts/exercices.js based on ./*.md files

var _ = require('lodash');
var fs = require('fs');
var mustache = require('mustache');
var QuizzRenderer = require('./QuizzRenderer');

var PATH_SOURCE = './';
var OUTPUT_FILE = './public/scripts/exercises.js';

var RE_TEMPLATE_FILE = /ex\.(\d+)\.(code|quizz)\.template\.md/;

function makeRegexTester(regex) {
  return regex.test.bind(regex);
}

function renderExercisesFile(exercises) {
  return [
    '// generated by build-exercises.js',
    '(function(document) {',
    '  \'use strict\';',
    '  document.querySelector(\'#app\').exercises = '
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
    if (exEval) {
      exEval = exEval.replace(/```js\n*/g, '').replace(/```\n*/g, '');
    }
    evalTests.push({
      i: q + 1, // TODO: prevent id collisions if more than one code.template.md file is used
      id: 'code' + (q + 1), // TODO: allow each question to override this id
      variants: variants,
      testVariants: variants.map(function renderVariant(variantData, i) {
        return exEval && mustache.render(exEval, variantData);
      })
    });
    return {
      i: q + 1, // TODO: prevent id collisions if more than one code.template.md file is used
      id: 'code' + (q + 1), // TODO: allow each question to override this id
      mdVariants: variants.map(function renderVariant(variantData, i) {
        return mustache.render(exText, variantData);
      })      
    };
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
  // generate solution file, for evaluation of students' answers using QuizzEvaluator.js
  var solFile = PATH_SOURCE + 'ex.' + exNumber + '.quizz.solutions.json';
  fs.writeFileSync(solFile, JSON.stringify(exerciseData.getSolutions(), null, 2));
  // return rendered questions, for web client
  return {
    isQuizz: true,
    title: 'QCM',
    questions: exerciseData.renderJsonQuestions()
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
