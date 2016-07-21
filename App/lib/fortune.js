
var fortunes = [
    "Conquer your fears or they will conquer  you.",
    "Rivers need springs",
    "You will have a pleasant surprise",
    "You are awesome"
];


exports.getFortune = function() {
    var randomFortune = fortunes[Math.floor(Math.random() * fortunes.length)];
    return randomFortune;
};