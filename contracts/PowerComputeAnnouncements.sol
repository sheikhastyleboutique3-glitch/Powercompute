// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./common/PowerComputeBase.sol";

/**
 * @title PowerComputeAnnouncements
 * @author PowerCompute Protocol
 * @notice A minimal, fully on-chain CMS for protocol announcements/articles.
 *         Since this dApp has zero backend and zero database (static HTML
 *         only), this contract IS the content management system: the owner
 *         publishes/edits/archives posts here, and the public site reads
 *         them directly from the chain via a read-only RPC provider — no
 *         server, no database, nothing that can go down or be censored
 *         except the chain itself.
 *
 * Design notes:
 *  - Post bodies are stored as plain on-chain strings. This keeps the
 *    system fully trustless and dependency-free, at the cost of gas scaling
 *    with content length. For long-form articles, store a short summary
 *    on-chain and put the full text behind an off-chain/IPFS `externalUrl`.
 *  - `publish` creates a new post. `editPost` overwrites an existing post's
 *    fields (title/body/tag/externalUrl) while preserving its original
 *    `publishedAt` timestamp and id. `archivePost` / `unarchivePost` let the
 *    owner hide/restore a post from public listings without deleting
 *    history.
 *  - Only the contract owner (the same wallet that owns PowerComputeToken,
 *    by convention) can write. Anyone can read.
 */
contract PowerComputeAnnouncements is Ownable, Pausable {
    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    struct Post {
        uint256 id;
        string title;
        string body;
        string tag;         // e.g. "Announcement", "Roadmap Update", "Security"
        string externalUrl; // optional link to full article / IPFS / blog post
        address author;
        uint256 publishedAt;
        uint256 updatedAt;
        bool archived;
    }

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------

    uint256 public nextPostId = 1;
    mapping(uint256 => Post) public posts;
    uint256 public totalPosts;

    /// @notice Additional addresses (besides the owner) allowed to publish/edit content.
    mapping(address => bool) public editors;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event PostPublished(uint256 indexed postId, address indexed author, string title, string tag);
    event PostEdited(uint256 indexed postId, address indexed editor);
    event PostArchived(uint256 indexed postId);
    event PostUnarchived(uint256 indexed postId);
    event EditorUpdated(address indexed editor, bool allowed);

    // ------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------

    modifier onlyEditor() {
        require(msg.sender == owner() || editors[msg.sender], "Announcements: caller is not an editor");
        _;
    }

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ------------------------------------------------------------------
    // Write functions (owner + approved editors only)
    // ------------------------------------------------------------------

    /**
     * @notice Publish a new announcement/article.
     */
    function publish(
        string calldata title,
        string calldata body,
        string calldata tag,
        string calldata externalUrl
    ) external onlyEditor whenNotPaused returns (uint256 postId) {
        require(bytes(title).length > 0, "Announcements: title required");

        postId = nextPostId++;

        posts[postId] = Post({
            id: postId,
            title: title,
            body: body,
            tag: tag,
            externalUrl: externalUrl,
            author: msg.sender,
            publishedAt: block.timestamp,
            updatedAt: block.timestamp,
            archived: false
        });

        totalPosts += 1;

        emit PostPublished(postId, msg.sender, title, tag);
    }

    /**
     * @notice Edit an existing post's content in place. Preserves the
     *         original id and `publishedAt` timestamp; updates `updatedAt`.
     */
    function editPost(
        uint256 postId,
        string calldata title,
        string calldata body,
        string calldata tag,
        string calldata externalUrl
    ) external onlyEditor {
        Post storage post = posts[postId];
        require(post.publishedAt != 0, "Announcements: post does not exist");
        require(bytes(title).length > 0, "Announcements: title required");

        post.title = title;
        post.body = body;
        post.tag = tag;
        post.externalUrl = externalUrl;
        post.updatedAt = block.timestamp;

        emit PostEdited(postId, msg.sender);
    }

    /**
     * @notice Hide a post from public listings without deleting its history.
     */
    function archivePost(uint256 postId) external onlyEditor {
        Post storage post = posts[postId];
        require(post.publishedAt != 0, "Announcements: post does not exist");
        require(!post.archived, "Announcements: already archived");

        post.archived = true;
        emit PostArchived(postId);
    }

    /**
     * @notice Restore a previously archived post to public listings.
     */
    function unarchivePost(uint256 postId) external onlyEditor {
        Post storage post = posts[postId];
        require(post.publishedAt != 0, "Announcements: post does not exist");
        require(post.archived, "Announcements: not archived");

        post.archived = false;
        emit PostUnarchived(postId);
    }

    // ------------------------------------------------------------------
    // Owner administration
    // ------------------------------------------------------------------

    /**
     * @notice Approve or revoke an additional editor address (besides the
     *         owner) who may publish/edit/archive posts.
     */
    function setEditor(address editorAddr, bool allowed) external onlyOwner {
        require(editorAddr != address(0), "Announcements: zero address editor");
        editors[editorAddr] = allowed;
        emit EditorUpdated(editorAddr, allowed);
    }

    // Note: pause()/unpause()/paused() are inherited directly from the
    // Pausable base (see contracts/common/PowerComputeBase.sol) — no need
    // to redeclare them here.

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function getPost(uint256 postId) external view returns (Post memory) {
        return posts[postId];
    }

    /**
     * @notice Returns up to `limit` most recent non-archived posts, newest
     *         first, starting the scan from `nextPostId - 1` backwards.
     *         Simple and gas-light for a testnet-scale content volume.
     */
    function getRecentPosts(uint256 limit) external view returns (Post[] memory result) {
        uint256 total = nextPostId - 1;
        if (total == 0 || limit == 0) {
            return result;
        }

        Post[] memory buffer = new Post[](limit);
        uint256 count = 0;

        for (uint256 i = total; i >= 1 && count < limit; i--) {
            Post storage p = posts[i];
            if (!p.archived) {
                buffer[count] = p;
                count += 1;
            }
            if (i == 1) break; // avoid uint underflow on the loop decrement
        }

        result = new Post[](count);
        for (uint256 j = 0; j < count; j++) {
            result[j] = buffer[j];
        }
    }
}
