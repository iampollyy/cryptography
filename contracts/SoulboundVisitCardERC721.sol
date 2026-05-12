// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract SoulboundVisitCardERC721 is ERC721, Ownable {
    using Strings for uint256;
    using Strings for address;

    uint256 private _nextTokenId;
    mapping(address => bool) public hasMinted;
    string private _imageURI;

    struct StudentInfo {
        string studentName;
        string course;
    }

    mapping(uint256 => StudentInfo) public studentInfo;

    event VisitCardMinted(
        address indexed student,
        uint256 indexed tokenId,
        string studentName,
        string course
    );

    constructor(
        address initialOwner,
        string memory imageURI_
    ) ERC721("StudentVisitCard", "SVC") Ownable(initialOwner) {
        _imageURI = imageURI_;
    }

    function mintVisitCard(
        address student,
        string calldata name_,
        string calldata course_
    ) external onlyOwner {
        require(!hasMinted[student], "Student already has a visit card");

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        studentInfo[tokenId] = StudentInfo({
            studentName: name_,
            course: course_
        });

        hasMinted[student] = true;
        _safeMint(student, tokenId);

        emit VisitCardMinted(student, tokenId, name_, course_);
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721) returns (address) {
        address from = _ownerOf(tokenId);

        if (from != address(0)) {
            revert("Soulbound: token is non-transferable");
        }

        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert("Soulbound: approvals are disabled");
    }

    function setApprovalForAll(address, bool) public pure override {
        revert("Soulbound: approvals are disabled");
    }

    function setImageURI(string calldata newImageURI) external onlyOwner {
        _imageURI = newImageURI;
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721) returns (string memory) {
        _requireOwned(tokenId);

        StudentInfo storage info = studentInfo[tokenId];

        string memory json = string(abi.encodePacked(
            '{"name":"Student Visit Card #', tokenId.toString(),
            '","description":"Soulbound student visit card NFT. This token is permanently bound to the holder wallet and cannot be transferred."',
            ',"image":"', _imageURI,
            '","attributes":[',
            '{"trait_type":"Student Name","value":"', info.studentName, '"},',
            '{"trait_type":"Course","value":"', info.course, '"},',
            '{"trait_type":"Type","value":"Soulbound"}',
            ']}'
        ));

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    function getStudentInfo(
        uint256 tokenId
    )
        external
        view
        returns (
            string memory studentName,
            string memory course
        )
    {
        _requireOwned(tokenId);

        StudentInfo storage info = studentInfo[tokenId];
        return (info.studentName, info.course);
    }
}
