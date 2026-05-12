// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title SoulboundVisitCardERC721
 * @notice Soulbound (non-transferable) NFT representing a student visit card.
 *         Each student can receive exactly one token. After minting, the token
 *         cannot be transferred or approved — it is permanently bound to the
 *         student's wallet.
 *
 * @dev    Built on OpenZeppelin v5 ERC-721.
 *         Image and metadata are generated fully on-chain as SVG + Base64 JSON.
 *         Soulbound behaviour is enforced by:
 *         1. Overriding `_update` to revert on any transfer (except minting).
 *         2. Overriding `approve` and `setApprovalForAll` to always revert.
 */
contract SoulboundVisitCardERC721 is ERC721, Ownable {
    using Strings for uint256;
    using Strings for address;

    // ───────── State Variables ─────────

    /// @notice Next token ID to be minted (auto-incremented).
    uint256 private _nextTokenId;

    /// @notice Tracks whether an address has already received a visit card.
    mapping(address => bool) public hasMinted;

    // ───────── Student Metadata (on-chain) ─────────

    struct StudentInfo {
        string studentName; // e.g. "Polina Trybialustava"
        string studentID;   // e.g. "2024001"
        string course;      // e.g. "Cryptography"
        string year;        // e.g. "2024"
    }

    /// @notice Mapping from token ID to student info stored on-chain.
    mapping(uint256 => StudentInfo) public studentInfo;

    // ───────── Events ─────────

    event VisitCardMinted(
        address indexed student,
        uint256 indexed tokenId,
        string studentName,
        string studentID
    );

    // ───────── Constructor ─────────

    /**
     * @param initialOwner The admin/deployer address that will own the contract.
     */
    constructor(
        address initialOwner
    ) ERC721("StudentVisitCard", "SVC") Ownable(initialOwner) {}

    // ═══════════════════════════════════════════════════════════════════
    //  MINTING (only owner / admin)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Mint a soulbound visit card NFT to a student's wallet.
     * @param student  The wallet address of the student.
     * @param name_    Student's full name.
     * @param id_      Student ID number.
     * @param course_  Course name.
     * @param year_    Academic year.
     */
    function mintVisitCard(
        address student,
        string calldata name_,
        string calldata id_,
        string calldata course_,
        string calldata year_
    ) external onlyOwner {
        // Each student can only receive one visit card
        require(!hasMinted[student], "Student already has a visit card");

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        // Store on-chain metadata
        studentInfo[tokenId] = StudentInfo({
            studentName: name_,
            studentID: id_,
            course: course_,
            year: year_
        });

        // Mark student as having a visit card
        hasMinted[student] = true;

        // Mint the token (metadata is generated dynamically in tokenURI)
        _safeMint(student, tokenId);

        emit VisitCardMinted(student, tokenId, name_, id_);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  SOULBOUND LOGIC — block all transfers after minting
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @dev Override `_update` to prevent any transfer except the initial mint.
     *      During minting, `from` is address(0), so we allow that.
     *      Any other transfer (from != address(0)) is reverted.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721) returns (address) {
        address from = _ownerOf(tokenId);

        // Allow minting (from == address(0)), block all other transfers
        if (from != address(0)) {
            revert("Soulbound: token is non-transferable");
        }

        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Disable approval — soulbound tokens cannot be approved for transfer.
     */
    function approve(address, uint256) public pure override {
        revert("Soulbound: approvals are disabled");
    }

    /**
     * @dev Disable operator approval — soulbound tokens cannot be approved for transfer.
     */
    function setApprovalForAll(address, bool) public pure override {
        revert("Soulbound: approvals are disabled");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  ON-CHAIN SVG IMAGE GENERATION
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @dev Generates an SVG visit card image entirely on-chain.
     */
    function _generateSVG(uint256 tokenId) internal view returns (string memory) {
        StudentInfo storage info = studentInfo[tokenId];

        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250">',
            '<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">'
            '<stop offset="0%" style="stop-color:#1a1a2e"/>'
            '<stop offset="100%" style="stop-color:#16213e"/>'
            '</linearGradient></defs>',
            '<rect width="400" height="250" rx="15" fill="url(#bg)"/>',
            '<rect x="10" y="10" width="380" height="230" rx="10" fill="none" stroke="#e94560" stroke-width="2"/>',
            // Title
            '<text x="200" y="45" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="#e94560">',
            unicode'🎓 STUDENT VISIT CARD</text>',
            // Soulbound badge
            '<rect x="130" y="55" width="140" height="22" rx="11" fill="#e94560"/>',
            '<text x="200" y="71" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="white">SOULBOUND NFT</text>',
            // Student name
            '<text x="30" y="110" font-family="Arial,sans-serif" font-size="12" fill="#aaa">Name:</text>',
            '<text x="30" y="128" font-family="Arial,sans-serif" font-size="16" font-weight="bold" fill="white">', info.studentName, '</text>',
            // Student ID
            '<text x="30" y="158" font-family="Arial,sans-serif" font-size="12" fill="#aaa">Student ID:</text>',
            '<text x="120" y="158" font-family="Arial,sans-serif" font-size="14" fill="white">', info.studentID, '</text>',
            // Course
            '<text x="30" y="183" font-family="Arial,sans-serif" font-size="12" fill="#aaa">Course:</text>',
            '<text x="100" y="183" font-family="Arial,sans-serif" font-size="14" fill="white">', info.course, '</text>',
            // Year
            '<text x="30" y="208" font-family="Arial,sans-serif" font-size="12" fill="#aaa">Year:</text>',
            '<text x="80" y="208" font-family="Arial,sans-serif" font-size="14" fill="white">', info.year, '</text>',
            // Token ID
            '<text x="370" y="235" text-anchor="end" font-family="monospace" font-size="10" fill="#555">#', tokenId.toString(), '</text>',
            '</svg>'
        ));
    }

    // ═══════════════════════════════════════════════════════════════════
    //  FULLY ON-CHAIN tokenURI (SVG image + JSON metadata)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Returns a fully on-chain data URI with JSON metadata and SVG image.
     *         No IPFS or external server needed — everything is generated from
     *         contract storage.
     */
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721) returns (string memory) {
        _requireOwned(tokenId);

        StudentInfo storage info = studentInfo[tokenId];

        // Build the SVG image as a base64 data URI
        string memory svgBase64 = Base64.encode(bytes(_generateSVG(tokenId)));
        string memory imageURI = string(abi.encodePacked("data:image/svg+xml;base64,", svgBase64));

        // Build JSON metadata
        string memory json = string(abi.encodePacked(
            '{"name":"Student Visit Card #', tokenId.toString(),
            '","description":"Soulbound student visit card NFT. This token is permanently bound to the holder wallet and cannot be transferred."',
            ',"image":"', imageURI,
            '","attributes":[',
            '{"trait_type":"Student Name","value":"', info.studentName, '"},',
            '{"trait_type":"Student ID","value":"', info.studentID, '"},',
            '{"trait_type":"Course","value":"', info.course, '"},',
            '{"trait_type":"Year","value":"', info.year, '"},',
            '{"trait_type":"Type","value":"Soulbound"}',
            ']}'
        ));

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }

    // ═══════════════════════════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Returns the total number of visit cards minted so far.
     */
    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    /**
     * @notice Get the student information for a given token ID.
     */
    function getStudentInfo(
        uint256 tokenId
    )
        external
        view
        returns (
            string memory studentName,
            string memory studentID,
            string memory course,
            string memory year
        )
    {
        _requireOwned(tokenId);

        StudentInfo storage info = studentInfo[tokenId];
        return (info.studentName, info.studentID, info.course, info.year);
    }
}
