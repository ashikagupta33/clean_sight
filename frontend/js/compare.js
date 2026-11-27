
// Get HTML elements
const beforeInput = document.getElementById("beforeImage");
const afterInput = document.getElementById("afterImage");

const beforePreview = document.getElementById("beforePreview");
const afterPreview = document.getElementById("afterPreview");

const compareBtn = document.getElementById("compareBtn");
const results = document.getElementById("results");


// Function to preview uploaded image
function showPreview(input, preview) {

    input.addEventListener("change", function () {

        const file = input.files[0];

        if (file) {

            if (!file.type.startsWith("image/")) {
                alert("Please upload a valid image!");
                input.value = "";
                preview.src = "";
                preview.style.display = "none";
                return;
            }

            const imageURL = URL.createObjectURL(file);

            preview.src = imageURL;
            preview.style.display = "block";
        }

    });

}


// Add preview functionality
showPreview(beforeInput, beforePreview);
showPreview(afterInput, afterPreview);


// Compare button functionality
compareBtn.addEventListener("click", function () {

    const beforeFile = beforeInput.files[0];
    const afterFile = afterInput.files[0];

    if (!beforeFile || !afterFile) {
        alert("Please upload both before and after images!");
        return;
    }

    results.innerHTML = `
        <h2>Images Ready!</h2>
        <p>Both images have been uploaded successfully.</p>
        <p>Waste detection will be performed after backend integration.</p>
    `;

});

// Calculate and display comparison results
function displayComparisonResults(beforeCounts, afterCounts) {

    const categories = [
        {
            name: "bottle",
            beforeId: "beforeBottle",
            afterId: "afterBottle"
        },
        {
            name: "can",
            beforeId: "beforeCan",
            afterId: "afterCan"
        },
        {
            name: "paper",
            beforeId: "beforePaper",
            afterId: "afterPaper"
        },
        {
            name: "plastic",
            beforeId: "beforePlastic",
            afterId: "afterPlastic"
        }
    ];

    let beforeTotal = 0;
    let afterTotal = 0;

    categories.forEach(function(category) {

        const before = Number(beforeCounts[category.name] || 0);
        const after = Number(afterCounts[category.name] || 0);

        document.getElementById(category.beforeId).textContent = before;
        document.getElementById(category.afterId).textContent = after;

        beforeTotal += before;
        afterTotal += after;

    });

    // Calculate total waste
    document.getElementById("beforeCount").textContent = beforeTotal;
    document.getElementById("afterCount").textContent = afterTotal;

    // Calculate reduction percentage
    let reduction = 0;

    if (beforeTotal > 0) {
        reduction = ((beforeTotal - afterTotal) / beforeTotal) * 100;
    }

    document.getElementById("reduction").textContent =
        reduction.toFixed(2) + "%";

    document.getElementById("comparisonMessage").textContent =
        "Comparison calculated successfully.";

}
// Temporary testing data
const sampleBefore = {
    bottle: 20,
    can: 10,
    paper: 5,
    plastic: 5
};

const sampleAfter = {
    bottle: 5,
    can: 2,
    paper: 2,
    plastic: 1
};

displayComparisonResults(sampleBefore, sampleAfter);