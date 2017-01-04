// This class checks students' answers (in JSON format) against quizz solutions
// (as generated by ExerciseParser), and computes scores.

var fs = require('fs');

var config = require('../exam-data/exam-config.js');
var PTS_RIGHT = config.quizzGrading.ptsRight;
var PTS_WRONG = config.quizzGrading.ptsWrong; // or -0.5 for example
var PTS_NULL = config.quizzGrading.ptsNull;

function QuizzEvaluator(solutions) {
  this.solutions = solutions;
  this.scoreAnswer = function (answer, expected) {
    return !answer ? PTS_NULL : (answer == expected ? PTS_RIGHT : PTS_WRONG);
  };
}

QuizzEvaluator.prototype.readSolutionsFromFile = function(filePath) {
  this.solutions = JSON.parse(fs.readFileSync(filePath).toString());
  return this;
};

QuizzEvaluator.prototype.getAnswerSet = function(answers) {
  var set = {};
  for (var id in this.solutions) {
    set[id] = answers[id];
  }
  return set;
};

QuizzEvaluator.prototype.evaluateAnswers = function(answers) {
  var log = [];
  var score = 0;
  for (var id in this.solutions) {
    var points = this.scoreAnswer(answers[id], this.solutions[id]);
    score += points;
    log.push({
      questionId: id,
      answer: answers[id],
      solution: this.solutions[id],
      points: points
    });
  }
  return {
    length: Object.keys(this.solutions).length * PTS_RIGHT, // = maximum score
    score: score,
    log: log,    
  };
};

QuizzEvaluator.prototype.evaluateSubmissions = function(submissions) {
  var students = {};
  for (var studentId in submissions) {
    students[studentId] = this.evaluateAnswers(submissions[studentId]);
  }
  return students;
};

QuizzEvaluator.prototype.evaluateSubmissionsFromFile = function(filePath) {
  return this.evaluateSubmissions(JSON.parse(fs.readFileSync(filePath).toString()).submissions);
};

module.exports = QuizzEvaluator;
